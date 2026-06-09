// ---------------------------------------------------------------------------
// Standardized API Responses
// ---------------------------------------------------------------------------
// Every API route returns a consistent response shape.
// Mobile clients can rely on this structure across all endpoints.
//
// Success: { success: true, data: T, meta?: { ... } }
// Error:   { success: false, error: { code, message, details? } }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

// ─── Success ────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return ok(data, meta, 201);
}

export function accepted<T>(data: T, meta?: Record<string, unknown>) {
  return ok(data, meta, 202);
}

// ─── Error ──────────────────────────────────────────────────────────────────

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function error(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  const body: ApiError = {
    success: false,
    error: { code, message },
  };
  if (details) body.error.details = details;
  return NextResponse.json(body, { status });
}

export function badRequest(message: string, details?: unknown) {
  return error("BAD_REQUEST", message, 400, details);
}

export function notFound(message = "Resource not found") {
  return error("NOT_FOUND", message, 404);
}

export function serverError(message = "Internal server error") {
  return error("SERVER_ERROR", message, 500);
}

// ─── Pagination Meta ───────────────────────────────────────────────────────

export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
