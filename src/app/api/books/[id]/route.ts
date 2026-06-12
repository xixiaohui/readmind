// ---------------------------------------------------------------------------
// GET /api/books/[id]
// ---------------------------------------------------------------------------
// Returns a book with all completed analyses, themes, and quotes.
// This is the primary endpoint for mobile app's book detail screen.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books, bookAnalysis, workflowRuns, workflowSteps, quotes, themes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { ok, notFound, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params;

  // Check if client wants rawText (for reader page) - MUST be before any await
  const url = new URL(_request.url);
  const includeRawText = url.searchParams.get("includeRawText") === "true";

  // Get book (without rawText first)
  const baseFields = {
    id: books.id,
    title: books.title,
    author: books.author,
    status: books.status,
    chunkCount: books.chunkCount,
    isPublic: books.isPublic,
    createdAt: books.createdAt,
    updatedAt: books.updatedAt,
  };

  let book;
  if (includeRawText) {
    // Include rawText if requested
    const [result] = await db
      .select({
        ...baseFields,
        rawText: books.rawText,
      })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);
    book = result;
  } else {
    // Don't include rawText
    const [result] = await db
      .select(baseFields)
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);
    book = result;
  }

  // Get all completed analyses
  const analyses = await db
    .select({
      id: bookAnalysis.id,
      analysisType: bookAnalysis.analysisType,
      result: bookAnalysis.result,
      createdAt: bookAnalysis.createdAt,
    })
    .from(bookAnalysis)
    .where(eq(bookAnalysis.bookId, bookId));

  // Get latest workflow run
  const [latestWorkflow] = await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      progress: workflowRuns.progress,
      currentNode: workflowRuns.currentNode,
      errors: workflowRuns.errors,
      startedAt: workflowRuns.startedAt,
      completedAt: workflowRuns.completedAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.bookId, bookId))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(1);

  // Get step history for the latest workflow (for progress display)
  let stepHistory: { nodeName: string; status: string; error: string | null }[] = [];
  if (latestWorkflow) {
    const steps = await db
      .select({
        nodeName: workflowSteps.nodeName,
        status: workflowSteps.status,
        error: workflowSteps.error,
      })
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, latestWorkflow.id))
      .orderBy(workflowSteps.createdAt);
    stepHistory = steps.map((s) => ({
      nodeName: s.nodeName,
      status: s.status,
      error: s.error,
    }));
  }

  // Get quotes and themes if they exist
  const bookQuotes = await db
    .select({
      id: quotes.id,
      text: quotes.text,
      context: quotes.context,
      category: quotes.category,
      score: quotes.score,
    })
    .from(quotes)
    .where(eq(quotes.bookId, bookId))
    .orderBy(desc(quotes.score))
    .limit(50);

  const bookThemes = await db
    .select({
      id: themes.id,
      name: themes.name,
      description: themes.description,
      weight: themes.weight,
      evidence: themes.evidence,
    })
    .from(themes)
    .where(eq(themes.bookId, bookId))
    .orderBy(desc(themes.weight));

  return ok({
    book: {
      ...book,
      ...(includeRawText && { rawText: book.rawText }),
    },
    analyses: analyses.map((a) => ({
      id: a.id,
      type: a.analysisType,
      result: a.result,
      createdAt: a.createdAt,
    })),
    latestWorkflow: latestWorkflow
      ? { ...latestWorkflow, steps: stepHistory }
      : null,
    quotes: bookQuotes,
    themes: bookThemes,
  });
});

export const DELETE = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "Login required", 401);

  const { id: bookId } = await params;

  // Verify book exists and belongs to user
  const [book] = await db
    .select({ id: books.id, userId: books.userId, title: books.title })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) return notFound("Book not found");
  if (book.userId !== user.sub) return error("FORBIDDEN", "Not your book", 403);

  // CASCADE deletes all related data: workflows, steps, analyses, quotes, themes
  await db.delete(books).where(eq(books.id, bookId));

  return ok({ deleted: bookId, title: book.title });
});

// ---------------------------------------------------------------------------
// PATCH /api/books/[id]
// ---------------------------------------------------------------------------
// Update book fields (e.g., isPublic).
// Only the book owner can update.
// ---------------------------------------------------------------------------

export const PATCH = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "Login required", 401);

  const { id: bookId } = await params;
  const body = await request.json();

  // Verify book exists and belongs to user
  const [book] = await db
    .select({ id: books.id, userId: books.userId, title: books.title })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) return notFound("Book not found");
  if (book.userId !== user.sub) return error("FORBIDDEN", "Not your book", 403);

  // Update fields
  const updates: Partial<{ isPublic: boolean }> = {};

  if (body.isPublic !== undefined) {
    updates.isPublic = Boolean(body.isPublic);
  }

  if (Object.keys(updates).length === 0) {
    return error("BAD_REQUEST", "No fields to update", 400);
  }

  await db
    .update(books)
    .set(updates)
    .where(eq(books.id, bookId));

  return ok({ updated: bookId, title: book.title, changes: updates });
});
