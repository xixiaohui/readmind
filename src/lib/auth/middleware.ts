// ---------------------------------------------------------------------------
// Auth Middleware — JWT Verification for API Routes
// ---------------------------------------------------------------------------
// Usage in any route handler:
//   const user = await authenticate(request);
//   if (!user) return unauthorized();
//
// The middleware extracts the Bearer token from the Authorization header,
// verifies it, and returns the user payload. Routes that don't need auth
// simply don't call it.
// ---------------------------------------------------------------------------

import { verifyToken, type JwtPayload } from "./jwt";

/**
 * Extracts and verifies the JWT from a request's Authorization header.
 * Returns the user payload if valid, null otherwise.
 */
export async function authenticate(
  request: Request
): Promise<JwtPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyToken(token);
}
