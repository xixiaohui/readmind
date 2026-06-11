// ---------------------------------------------------------------------------
// POST /api/books/upload
// ---------------------------------------------------------------------------
// Upload a book for analysis. Accepts title, optional author, and full text.
// Creates a book record in PostgreSQL with status "analyzing".
// Automatically launches the AI analysis workflow in the background.
// Returns the book ID and workflow ID for client navigation.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { UploadBookSchema } from "@/lib/api/validators";
import { authenticate, canAnalyze } from "@/lib/auth";
import { created, badRequest, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";
import { triggerWorkflow } from "@/lib/workflow";

export const POST = withErrorHandler(async (request: Request) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "Login required", 401);

  const body = await request.json();

  // Validate input
  const parsed = UploadBookSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const { title, author, text } = parsed.data;

  // ── Quota check ──────────────────────────────────────────────────────
  if (!canAnalyze(user)) {
    return error(
      "QUOTA_EXCEEDED",
      "本月免费分析额度已用完（3本/月）。请升级会员继续使用。",
      402
    );
  }

  // Create book record
  const [book] = await db
    .insert(books)
    .values({
      userId: user.sub,
      title,
      author: author ?? null,
      rawText: text,
      status: "analyzing",
    })
    .returning({
      id: books.id,
      title: books.title,
      author: books.author,
      status: books.status,
      createdAt: books.createdAt,
    });

  if (!book) {
    return badRequest("Failed to create book record");
  }

  // Auto-trigger analysis workflow (fire-and-forget)
  let workflowId: string | null = null;
  try {
    const result = await triggerWorkflow({
      bookId: book.id,
      userId: user.sub,
      title: book.title,
    });
    workflowId = result.workflowId;
  } catch (err) {
    // Analysis trigger failed — book is still uploaded, user can retry
    console.error(
      `[Upload] Failed to trigger analysis for book ${book.id}:`,
      err instanceof Error ? err.message : String(err)
    );
    // Reset book status so frontend shows "Start Analysis" button
    await db
      .update(books)
      .set({ status: "uploaded" })
      .where(eq(books.id, book.id));
  }

  // Increment analysis count for quota tracking
  if (workflowId) {
    await db
      .update(users)
      .set({ analysisCount: sql`analysis_count + 1` })
      .where(eq(users.id, user.sub))
      .catch(() => {});
  }

  return created(
    {
      bookId: book.id,
      title: book.title,
      author: book.author,
      status: book.status,
      workflowId,
      createdAt: book.createdAt,
    },
    { textLength: text.length }
  );
});
