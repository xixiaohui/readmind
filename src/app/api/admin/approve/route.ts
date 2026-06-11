// POST /api/admin/approve — approve or reject a payment order
import { db } from "@/lib/db/connection";
import { paymentOrders, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, error, notFound } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";
import { z } from "zod";

const ApproveSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  adminKey: z.string().min(1),
});

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) return badRequest("参数错误", parsed.error.flatten().fieldErrors);

  const { orderId, action, adminKey } = parsed.data;

  // Verify admin
  if (adminKey !== process.env.ADMIN_KEY) return error("FORBIDDEN", "管理密钥错误", 403);

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, orderId))
    .limit(1);

  if (!order) return notFound("订单不存在");
  if (order.status !== "pending") return badRequest("订单已处理");

  if (action === "approve") {
    // Calculate expiry
    const now = new Date();
    let expiresAt: Date;
    switch (order.tier) {
      case "monthly":
        expiresAt = new Date(now);
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        break;
      case "quarterly":
        expiresAt = new Date(now);
        expiresAt.setMonth(expiresAt.getMonth() + 3);
        break;
      case "yearly":
      default:
        expiresAt = new Date(now);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        break;
    }

    await db
      .update(users)
      .set({
        membershipTier: order.tier,
        membershipExpires: expiresAt,
        analysisLimit: -1, // unlimited
      })
      .where(eq(users.id, order.userId));

    await db
      .update(paymentOrders)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(paymentOrders.id, orderId));

    return ok({ message: "已激活会员", tier: order.tier, expiresAt: expiresAt.toISOString() });
  } else {
    await db
      .update(paymentOrders)
      .set({ status: "rejected", adminNote: "管理员拒绝" })
      .where(eq(paymentOrders.id, orderId));

    return ok({ message: "已拒绝" });
  }
});
