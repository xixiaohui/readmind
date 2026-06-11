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
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少8个字符"),
  name: z.string().min(1).max(100).optional(),
});

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return badRequest("输入有误", parsed.error.flatten().fieldErrors);

  const { email, password, name } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing) return badRequest("该邮箱已注册");

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), passwordHash, name: name ?? null })
    .returning({ id: users.id, email: users.email, name: users.name });

  if (!user) return badRequest("注册失败");

  // New user: free tier, 3/month limit
  const token = await signToken({
    sub: user.id,
    email: user.email,
    membership: "free",
    expiresAt: null,
    analysisCount: 0,
    analysisLimit: 3,
  });

  return created({ user: { id: user.id, email: user.email, name: user.name }, token });
});
