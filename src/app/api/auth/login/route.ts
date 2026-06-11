// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
import { db } from "@/lib/db/connection";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { ok, badRequest } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const POST = withErrorHandler(async (request: Request) => {
  const { email, password } = await request.json();
  if (!email || !password) return badRequest("邮箱和密码不能为空");

  const [user] = await db
    .select({
      id: users.id, email: users.email, name: users.name,
      passwordHash: users.passwordHash,
      membershipTier: users.membershipTier,
      membershipExpires: users.membershipExpires,
      analysisCount: users.analysisCount,
      analysisLimit: users.analysisLimit,
    })
    .from(users)
    .where(eq(users.email, (email as string).toLowerCase()))
    .limit(1);

  if (!user) return badRequest("邮箱或密码错误");

  const valid = await verifyPassword(password as string, user.passwordHash);
  if (!valid) return badRequest("邮箱或密码错误");

  const token = await signToken({
    sub: user.id,
    email: user.email,
    membership: user.membershipTier,
    expiresAt: user.membershipExpires?.toISOString() ?? null,
    analysisCount: user.analysisCount,
    analysisLimit: user.analysisLimit,
  });

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
});
