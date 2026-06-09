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
  if (!email || !password) return badRequest("Email and password required");

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, (email as string).toLowerCase()))
    .limit(1);

  if (!user) return badRequest("Invalid email or password");

  const valid = await verifyPassword(password as string, user.passwordHash);
  if (!valid) return badRequest("Invalid email or password");

  const token = await signToken({ sub: user.id, email: user.email });

  return ok({ user: { id: user.id, email: user.email, name: user.name }, token });
});
