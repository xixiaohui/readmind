// ---------------------------------------------------------------------------
// API Error Handler
// ---------------------------------------------------------------------------
// Wraps route handlers to catch unexpected errors and return standardized
// error responses instead of Next.js default 500 pages.
// ---------------------------------------------------------------------------

import { serverError } from "./responses";

/**
 * Wraps a route handler with standardized error handling.
 * Any uncaught error is logged and returned as a structured JSON response.
 *
 * Works with all Next.js route handler signatures:
 *   - (request: Request) => Promise<Response>
 *   - (request: Request, context: { params }) => Promise<Response>
 */
export function withErrorHandler<Args extends unknown[], Ret extends Response>(
  handler: (...args: Args) => Promise<Ret>
): (...args: Args) => Promise<Ret> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[API Error]", message, err);

      const isDev = process.env.NODE_ENV === "development";
      return serverError(isDev ? message : "Internal server error") as unknown as Ret;
    }
  };
}
