// ---------------------------------------------------------------------------
// JWT — Sign & Verify
// ---------------------------------------------------------------------------
// Uses `jose` (lightweight, Edge-compatible) instead of `jsonwebtoken`
// (Node-only). This works on Vercel Edge, serverless, and mobile backends.
// ---------------------------------------------------------------------------

import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);
const JWT_ISSUER = "readmind";
const JWT_EXPIRATION = "30d"; // device-safe: long-lived for mobile

export interface JwtPayload {
  sub: string;          // user ID
  email: string;
  membership: string;   // "free" | "monthly" | "quarterly" | "yearly"
  expiresAt: string | null;
  analysisCount: number;
  analysisLimit: number;
  iat?: number;
  exp?: number;
}

export interface SignTokenInput {
  sub: string;
  email: string;
  membership?: string;
  expiresAt?: string | null;
  analysisCount?: number;
  analysisLimit?: number;
}

export async function signToken(payload: SignTokenInput): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    membership: payload.membership ?? "free",
    expiresAt: payload.expiresAt ?? null,
    analysisCount: payload.analysisCount ?? 0,
    analysisLimit: payload.analysisLimit ?? 3,
  } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
