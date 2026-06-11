// POST /api/admin/verify — verify admin key
import { ok, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const POST = withErrorHandler(async (request: Request) => {
  const { key } = await request.json();
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) return error("CONFIG", "管理员密钥未配置", 500);
  if (key !== adminKey) return error("FORBIDDEN", "管理密钥错误", 403);

  return ok({ verified: true });
});
