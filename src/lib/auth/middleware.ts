// ---------------------------------------------------------------------------
// Auth Middleware — JWT Verification for API Routes
// ---------------------------------------------------------------------------
import { verifyToken, type JwtPayload } from "./jwt";

export type { JwtPayload };

/**
 * Extracts and verifies the JWT from a request's Authorization header.
 * Returns the user payload if valid, null otherwise.
 */
export async function authenticate(request: Request): Promise<JwtPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyToken(token);
}

// ═══════════════════════════════════════════════════════════════════════════
// Whitelist — unlimited access for specified emails (comma-separated in env)
// ═══════════════════════════════════════════════════════════════════════════

function getWhitelist(): Set<string> {
  const raw = process.env.MEMBERSHIP_WHITELIST ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isWhitelisted(email: string): boolean {
  return getWhitelist().has(email.toLowerCase());
}

// ═══════════════════════════════════════════════════════════════════════════
// Membership Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** True if the user has an active paid membership (or is whitelisted) */
export function hasMembership(payload: JwtPayload): boolean {
  if (isWhitelisted(payload.email)) return true;
  if (payload.membership === "free") return false;
  if (payload.expiresAt) {
    const exp = new Date(payload.expiresAt);
    if (exp < new Date()) return false;
  }
  return true;
}

/** True if the user can submit a new analysis */
export function canAnalyze(payload: JwtPayload): boolean {
  // Whitelisted users get unlimited access
  if (isWhitelisted(payload.email)) return true;
  // Paid members with unlimited (-1) can always analyze
  if (hasMembership(payload) && payload.analysisLimit === -1) return true;
  // Free tier: check monthly limit
  return payload.analysisCount < payload.analysisLimit;
}

/** Returns remaining quota as a human-readable string */
export function quotaDisplay(payload: JwtPayload): string {
  if (isWhitelisted(payload.email)) return "∞（白名单）";
  if (hasMembership(payload) && payload.analysisLimit === -1) return "∞";
  return `${payload.analysisCount}/${payload.analysisLimit}`;
}
