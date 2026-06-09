// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
import { db } from "@/lib/db/connection";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { created, badRequest } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

const RegisterSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100).optional(),
});

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const { email, password, name } = parsed.data;

  // Check duplicate
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing) return badRequest("Email already registered");

  // Create user
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email: email.toLowerCase(), passwordHash, name: name ?? null }).returning({ id: users.id, email: users.email, name: users.name });

  if (!user) return badRequest("Failed to create user");

  // Issue token
  const token = await signToken({ sub: user.id, email: user.email });

  return created({ user: { id: user.id, email: user.email, name: user.name }, token });
});
