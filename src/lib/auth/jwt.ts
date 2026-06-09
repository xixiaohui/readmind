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
  sub: string;   // user ID
  email: string;
  iat?: number;
  exp?: number;
}

export async function signToken(payload: { sub: string; email: string }): Promise<string> {
  return new SignJWT({ ...payload } as Record<string, unknown>)
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
