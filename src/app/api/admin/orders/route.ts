// GET /api/admin/orders?status=pending — list payment orders (admin only)
import { db } from "@/lib/db/connection";
import { paymentOrders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ok, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (request: Request) => {
  // Simple auth: Bearer token = admin key
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== process.env.ADMIN_KEY) {
    return error("FORBIDDEN", "未授权", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";

  const rows = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.status, status))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(50);

  return ok({ orders: rows });
});
