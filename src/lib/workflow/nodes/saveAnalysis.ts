// ---------------------------------------------------------------------------
// Node: saveAnalysis — Persist All Results to PostgreSQL
// ---------------------------------------------------------------------------
// Final node in the workflow. Reads the aggregatedResult from state
// and persists it across multiple normalized database tables.
//
// Writes to:
//   - book_analysis: one row per analysis type (aggregated result)
//   - quotes: extracted quotes with scores and categories
//   - themes: extracted themes with weights and evidence
//   - books: update status to "completed"
//
// After this node, the analysis is available via GET /api/books/{id}.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { bookAnalysis, quotes, themes } from "@/lib/db/schema";
import { books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { BookAnalysisStateType } from "../state";

export async function saveAnalysis(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const { bookId, workflowId, aggregatedResult } = state;

  if (!aggregatedResult) {
    console.warn("[saveAnalysis] No aggregated result to save.");
    return { currentNode: "saveAnalysis", workflowStatus: "completed" };
  }

  // ── 1. Save analysis entries ────────────────────────────────────────────

  const analysisEntries: {
    bookId: string;
    workflowId: string;
    analysisType: string;
    result: Record<string, unknown>;
  }[] = [];

  // Themes
  if (aggregatedResult.themes.length > 0) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "theme",
      result: { themes: aggregatedResult.themes },
    });
  }

  // Summary
  if (aggregatedResult.summary) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "summary",
      result: { summary: aggregatedResult.summary },
    });
  }

  // Quotes
  if (aggregatedResult.topQuotes.length > 0) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "quote",
      result: { quotes: aggregatedResult.topQuotes },
    });
  }

  // Philosophy
  if (aggregatedResult.philosophy.primaryFrameworks.length > 0) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "philosophy",
      result: { philosophy: aggregatedResult.philosophy },
    });
  }

  // Emotions
  if (aggregatedResult.emotions.overallTone !== "Unknown") {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "emotion",
      result: { emotions: aggregatedResult.emotions },
    });
  }

  // Batch insert
  if (analysisEntries.length > 0) {
    const inserted = await db
      .insert(bookAnalysis)
      .values(analysisEntries)
      .returning({ id: bookAnalysis.id, analysisType: bookAnalysis.analysisType });

    // ── 2. Save individual quotes ──────────────────────────────────────────
    const quoteAnalysisId = inserted.find((r) => r.analysisType === "quote")?.id;
    if (quoteAnalysisId && aggregatedResult.topQuotes.length > 0) {
      await db.insert(quotes).values(
        aggregatedResult.topQuotes.map((q) => ({
          bookId,
          analysisId: quoteAnalysisId,
          text: q.text,
          context: q.context,
          category: q.category,
          score: q.score,
        }))
      );
    }

    // ── 3. Save individual themes ──────────────────────────────────────────
    const themeAnalysisId = inserted.find((r) => r.analysisType === "theme")?.id;
    if (themeAnalysisId && aggregatedResult.themes.length > 0) {
      await db.insert(themes).values(
        aggregatedResult.themes.map((t) => ({
          bookId,
          analysisId: themeAnalysisId,
          name: t.name,
          description: t.description,
          weight: t.weight,
          evidence: { occurrences: t.occurrences },
        }))
      );
    }
  }

  // ── 4. Update book status ───────────────────────────────────────────────
  await db
    .update(books)
    .set({
      status: "completed",
      chunkCount: aggregatedResult.metadata.chunkCount,
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));

  return {
    currentNode: "saveAnalysis",
    workflowStatus: "completed",
  };
}
