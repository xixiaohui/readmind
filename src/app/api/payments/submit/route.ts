// POST /api/payments/submit — submit membership purchase order
import { db } from "@/lib/db/connection";
import { paymentOrders } from "@/lib/db/schema";
import { authenticate } from "@/lib/auth";
import { ok, badRequest, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TIER_PRICES: Record<string, number> = {
  monthly: 5900,
  quarterly: 15900,
  yearly: 65900,
};

export const POST = withErrorHandler(async (request: Request) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "请先登录", 401);

  const form = await request.formData();
  const tier = form.get("tier") as string;
  const file = form.get("proof") as File | null;

  if (!tier || !TIER_PRICES[tier]) {
    return badRequest("无效的会员方案");
  }
  if (!file || file.size === 0) {
    return badRequest("请上传付款截图");
  }
  if (file.size > 5 * 1024 * 1024) {
    return badRequest("截图文件不能超过 5MB");
  }

  // Save screenshot
  const uploadDir = path.join(process.cwd(), "public/uploads");
  await mkdir(uploadDir, { recursive: true });
  const ext = file.name.split(".").pop() ?? "png";
  const fileName = `${user.sub}_${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buf);

  await db.insert(paymentOrders).values({
    userId: user.sub,
    tier,
    amount: TIER_PRICES[tier]!,
    proofUrl: `/uploads/${fileName}`,
  });

  return ok({ message: "订单已提交，等待管理员审核" });
});
