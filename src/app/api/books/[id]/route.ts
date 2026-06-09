// ---------------------------------------------------------------------------
// GET /api/books/[id]
// ---------------------------------------------------------------------------
// Returns a book with all completed analyses, themes, and quotes.
// This is the primary endpoint for mobile app's book detail screen.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books, bookAnalysis, workflowRuns, quotes, themes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ok, notFound } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params;

  // Get book
  const [book] = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      status: books.status,
      chunkCount: books.chunkCount,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) {
    return notFound("Book not found");
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
      startedAt: workflowRuns.startedAt,
      completedAt: workflowRuns.completedAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.bookId, bookId))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(1);

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
    book,
    analyses: analyses.map((a) => ({
      id: a.id,
      type: a.analysisType,
      result: a.result,
      createdAt: a.createdAt,
    })),
    latestWorkflow: latestWorkflow ?? null,
    quotes: bookQuotes,
    themes: bookThemes,
  });
});
