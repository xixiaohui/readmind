// ---------------------------------------------------------------------------
// GET /api/auth/me — Get current user from JWT
// ---------------------------------------------------------------------------
import { db } from "@/lib/db/connection";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/middleware";
import { ok, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (request: Request) => {
  const payload = await authenticate(request);
  if (!payload) return error("UNAUTHORIZED", "Invalid or expired token", 401);

  const [user] = await db
    .select({
      id: users.id, email: users.email, name: users.name,
      membershipTier: users.membershipTier,
      membershipExpires: users.membershipExpires,
      analysisCount: users.analysisCount,
      analysisLimit: users.analysisLimit,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user) return error("UNAUTHORIZED", "User not found", 401);

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
    membership: {
      tier: user.membershipTier,
      expiresAt: user.membershipExpires?.toISOString() ?? null,
    },
    usage: { count: user.analysisCount, limit: user.analysisLimit },
  });
});
