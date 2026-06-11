# ReadMeet 付费会员系统 — 实施计划

> 个人收款码 + 管理后台激活模式。所有步骤按顺序执行，每步标注涉及文件和预期结果。

---

## 定价

| 等级 | 价格 | 月折合 | 分析限额 | 海报 |
|------|------|--------|---------|------|
| 免费 | ¥0 | — | **3 本/月** | 可生成 |
| 月度会员 | ¥59 | ¥59 | 无限 | 可生成 |
| 季度会员 | ¥159 | ¥53 | 无限 | 可生成 |
| 年费会员 | ¥600 | ¥50 | 无限 | 可生成 |

---

## 步骤 1：数据库 Schema 扩展

### 1.1 `users` 表新增 4 列

文件：`src/lib/db/schema/users.ts`

```sql
-- Drizzle schema
membershipTier:    text("membership_tier").notNull().default("free"),   // free | monthly | quarterly | yearly
membershipExpires: timestamp("membership_expires_at"),                   // NULL = 永久（免费）
analysisCount:     integer("analysis_count").notNull().default(0),       // 本月已分析次数
analysisLimit:     integer("analysis_limit").notNull().default(3),       // 免费用户 = 3，付费 = -1（无限）
```

迁移命令：`npm run db:push`

### 1.2 新建 `payment_orders` 表

文件：`src/lib/db/schema/payments.ts`

```ts
export const paymentOrders = pgTable("payment_orders", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tier:        text("tier").notNull(),             // monthly | quarterly | yearly
  amount:      integer("amount").notNull(),         // 单位：分（59元 = 5900）
  status:      text("status").notNull().default("pending"), // pending | approved | rejected
  proofUrl:    text("proof_url"),                   // 付款截图 URL
  adminNote:   text("admin_note"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  approvedAt:  timestamp("approved_at"),
});
```

注册到 `src/lib/db/schema/index.ts`。

迁移：`npm run db:push`

---

## 步骤 2：Auth 中间件增强

文件：`src/lib/auth.ts`

修改 `authenticate()` 函数，JWT 载荷中增加：

```ts
interface UserPayload {
  sub: string;        // userId
  email: string;
  membership: string; // "free" | "monthly" | "quarterly" | "yearly"
  expiresAt: string | null;
  analysisCount: number;
  analysisLimit: number;
}
```

JWT token 在登录时签发，包含会员信息。这样每个 API 请求都能直接读取，无需每次查库。

刷新逻辑：
- 如果 `expiresAt < now`，将 `membership` 重置为 `"free"`，`analysisLimit` 重置为 `3`
- 如果月初（`analysisCount` 的上次重置月 ≠ 当前月），`analysisCount` 重置为 `0`

同时导出 helper：

```ts
export function hasMembership(payload: UserPayload): boolean {
  return payload.membership !== "free";
}

export function canAnalyze(payload: UserPayload): boolean {
  if (payload.analysisLimit === -1) return true;       // 付费用户无限
  return payload.analysisCount < payload.analysisLimit; // 免费用户 3 本/月
}
```

---

## 步骤 3：权限拦截

### 3.1 上传拦截

文件：`src/app/api/books/upload/route.ts`

在 `const user = await authenticate(request)` 之后增加：

```ts
// 检查分析配额
const { hasMembership, canAnalyze } = await import("@/lib/auth");
if (!canAnalyze(user)) {
  return error("QUOTA_EXCEEDED", 
    "本月免费分析额度已用完（3本/月）。请升级会员继续使用。", 402);
}

// 分析成功后，递增计数
await db.update(users)
  .set({ analysisCount: sql`analysis_count + 1` })
  .where(eq(users.id, user.sub));
```

### 3.2 手动分析拦截

文件：`src/app/api/books/analyze/route.ts`

同上，在 `authenticate` 后增加配额检查。

### 3.3 前端拦截

书籍详情页 `src/app/book/[id]/page.tsx`：

- `startAnalysis` 中处理 402 状态码，弹出提示"本月免费额度已用完，升级会员即可无限分析"并跳转 `/pricing`
- 免费用户 `analysisCount` 显示为 "本月已分析 X/3"

---

## 步骤 4：定价页

文件：`src/app/pricing/page.tsx`

页面内容：

```
┌─────────────────────────────────────────┐
│          升级会员，无限分析              │
├──────────┬──────────┬──────────────────┤
│  月度     │  季度    │  年费            │
│  ¥59/月   │ ¥159/季  │  ¥659/年         │
│  折合59/月 │ 折合53/月 │  折合55/月       │
│  ✓ 无限   │ ✓ 无限    │  ✓ 无限          │
│  ✓ 海报   │ ✓ 海报    │  ✓ 海报          │
│  [升级]   │ [升级]    │  [升级]          │
└──────────┴──────────┴──────────────────┘
```

点击任一"升级"按钮 → 弹出对话框：
1. 显示收款二维码（微信/支付宝二选一，Tab 切换）
2. 转账备注提示（填写用户邮箱）
3. 上传付款截图
4. 提交 → `POST /api/payments/submit`

收款码图片放在 `public/qr/wechat.jpg` 和 `public/qr/alipay.jpg`（你自己生成后放入）。

### API：`POST /api/payments/submit`

```ts
export const POST = withErrorHandler(async (request: Request) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "请先登录", 401);

  const form = await request.formData();
  const tier = form.get("tier") as string;
  const file = form.get("proof") as File;

  // 上传截图到 public/uploads/
  const fileName = `${user.sub}_${Date.now()}.png`;
  // ... 写文件 ...

  await db.insert(paymentOrders).values({
    userId: user.sub,
    tier,
    amount: { monthly: 5900, quarterly: 15900, yearly: 65900 }[tier] ?? 0,
    proofUrl: `/uploads/${fileName}`,
  });

  return ok({ message: "订单已提交，等待管理员审核" });
});
```

---

## 步骤 5：管理后台

文件：`src/app/admin/payments/page.tsx`

### 访问控制

通过 URL query string 传递管理密钥：

```ts
// 简易鉴权：localStorage 存 adminKey
// 首次访问弹出输入框，校验后存入 localStorage
// 调用 POST /api/admin/verify { key }
```

API：`POST /api/admin/verify` 比对 `.env` 中的 `ADMIN_KEY`。

### 管理员界面

```
┌──────────────────────────────────────────────┐
│  待审核订单                                    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 用户: user@email.com                  │    │
│  │ 方案: 年度 ¥659                       │    │
│  │ 付款截图: [查看]                      │    │
│  │ 提交时间: 2026-06-11 15:30           │    │
│  │ [通过] [拒绝]                         │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### API：`POST /api/admin/approve`

```ts
// 请求体: { orderId, action: "approve" | "reject", adminKey }
export const POST = withErrorHandler(async (request: Request) => {
  const { orderId, action, adminKey } = await request.json();
  if (adminKey !== process.env.ADMIN_KEY) return error("FORBIDDEN", "管理密钥错误", 403);

  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);

  if (action === "approve") {
    // 计算到期时间
    const now = new Date();
    const expiresAt = order.tier === "monthly"   ? new Date(now.setMonth(now.getMonth() + 1))
                    : order.tier === "quarterly" ? new Date(now.setMonth(now.getMonth() + 3))
                    :                              new Date(now.setFullYear(now.getFullYear() + 1));

    await db.update(users).set({
      membershipTier: order.tier,
      membershipExpires: expiresAt.toISOString(),
      analysisLimit: -1,  // 无限
    }).where(eq(users.id, order.userId));

    await db.update(paymentOrders).set({
      status: "approved",
      approvedAt: new Date(),
    }).where(eq(paymentOrders.id, orderId));
  } else {
    await db.update(paymentOrders).set({
      status: "rejected",
      adminNote: "管理员拒绝",
    }).where(eq(paymentOrders.id, orderId));
  }

  return ok({ message: action === "approve" ? "已激活会员" : "已拒绝" });
});
```

---

## 步骤 6：登录时刷新会员状态

文件：`src/app/api/auth/login/route.ts` 和 `register/route.ts`

登录/注册返回的 JWT 需包含最新会员信息。在签发 JWT 时查库：

```ts
const [user] = await db.select({
  id: users.id, email: users.email, name: users.name,
  membershipTier: users.membershipTier,
  membershipExpires: users.membershipExpires,
  analysisCount: users.analysisCount,
  analysisLimit: users.analysisLimit,
}).from(users).where(eq(users.email, email));

const token = await new SignJWT({
  sub: user.id, email: user.email,
  membership: user.membershipTier,
  expiresAt: user.membershipExpires,
  analysisCount: user.analysisCount,
  analysisLimit: user.analysisLimit,
}).setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("30d")
  .sign(secret);
```

---

## 步骤 7：账户页

文件：`src/app/account/page.tsx`

显示内容：
- 当前会员等级（免费 / 月度 / 季度 / 年费）
- 到期时间（或 "永久免费"）
- 本月分析次数：X/3（免费用户）或 X/∞（会员）
- 升级按钮（免费用户可见）
- 订单历史（付费用户可见）

---

## 步骤 8：.env.local 配置

```env
# 管理员密钥（生成：openssl rand -hex 16）
ADMIN_KEY=xxxxxxxxxxxxxxxx
```

---

## 完整文件清单

| # | 操作 | 文件 |
|---|------|------|
| 1 | 修改 | `src/lib/db/schema/users.ts` — 加4列 |
| 2 | 新建 | `src/lib/db/schema/payments.ts` — 支付订单表 |
| 3 | 修改 | `src/lib/db/schema/index.ts` — 导出 payments |
| 4 | 运行 | `npm run db:push` |
| 5 | 修改 | `src/lib/auth.ts` — JWT 含会员信息 + `canAnalyze()` helper |
| 6 | 修改 | `src/app/api/auth/login/route.ts` — 登录返回会员信息 |
| 7 | 修改 | `src/app/api/auth/register/route.ts` — 注册返回会员信息 |
| 8 | 修改 | `src/app/api/books/upload/route.ts` — 配额检查 |
| 9 | 修改 | `src/app/api/books/analyze/route.ts` — 配额检查 |
| 10 | 新建 | `src/app/pricing/page.tsx` — 定价页 |
| 11 | 新建 | `src/app/api/payments/submit/route.ts` — 提交订单 |
| 12 | 新建 | `src/app/admin/payments/page.tsx` — 审核后台 |
| 13 | 新建 | `src/app/api/admin/verify/route.ts` — 管理员验证 |
| 14 | 新建 | `src/app/api/admin/approve/route.ts` — 批准/拒绝订单 |
| 15 | 新建 | `src/app/account/page.tsx` — 账户页 |
| 16 | 修改 | `src/app/book/[id]/page.tsx` — 402 弹窗提示 |
| 17 | 修改 | `.env.local` — 加 `ADMIN_KEY` |
| 18 | 准备 | `public/qr/wechat.jpg` + `public/qr/alipay.jpg` — 收款码 |

---

## 执行顺序

```
Schema → DB migrate → Auth 改造 → API 拦截 → 前端页面 → 配置 → 放收款码 → 测试
```

按顺序执行上述 18 个步骤，每步完成后验证再继续。
