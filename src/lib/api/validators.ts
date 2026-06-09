// ---------------------------------------------------------------------------
// API Request Validators — Zod Schemas
// ---------------------------------------------------------------------------
// Every API route validates its input with Zod BEFORE processing.
// This catches bad requests early and provides clear error messages.
// ---------------------------------------------------------------------------

import { z } from "zod";

// ─── Book Upload ────────────────────────────────────────────────────────────

export const UploadBookSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  author: z.string().max(200).optional(),
  text: z.string().min(100, "Text must be at least 100 characters"),
});

export type UploadBookRequest = z.infer<typeof UploadBookSchema>;

// ─── Start Analysis ────────────────────────────────────────────────────────

export const AnalyzeBookSchema = z.object({
  bookId: z.string().uuid("Invalid book ID"),
});

export type AnalyzeBookRequest = z.infer<typeof AnalyzeBookSchema>;

// ─── Pagination ────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationRequest = z.infer<typeof PaginationSchema>;
