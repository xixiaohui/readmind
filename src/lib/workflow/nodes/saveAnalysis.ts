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
//
// DESIGNED TO BE RESILIENT: if any individual result type is missing or
// malformed, the rest are still persisted. Partial results are better than
// complete failure.
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
    console.warn("[saveAnalysis] No aggregated result — saving partial state from agents");
    return savePartialResults(state);
  }

  let savedCount = 0;

  // ── 1. Save analysis entries ────────────────────────────────────────────

  const analysisEntries: {
    bookId: string;
    workflowId: string;
    analysisType: string;
    result: Record<string, unknown>;
  }[] = [];

  // Themes
  const themesList = aggregatedResult.themes ?? [];
  if (Array.isArray(themesList) && themesList.length > 0) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "theme",
      result: { themes: themesList },
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
  const quoteList = aggregatedResult.topQuotes ?? [];
  if (Array.isArray(quoteList) && quoteList.length > 0) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "quote",
      result: { quotes: quoteList },
    });
  }

  // Philosophy
  const philo = aggregatedResult.philosophy;
  if (philo && Array.isArray(philo.primaryFrameworks) && philo.primaryFrameworks.length > 0) {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "philosophy",
      result: { philosophy: philo },
    });
  }

  // Emotions
  const emo = aggregatedResult.emotions;
  if (emo && emo.overallTone && emo.overallTone !== "Unknown") {
    analysisEntries.push({
      bookId,
      workflowId,
      analysisType: "emotion",
      result: { emotions: emo },
    });
  }

  // Batch insert with error isolation
  if (analysisEntries.length > 0) {
    try {
      const inserted = await db
        .insert(bookAnalysis)
        .values(analysisEntries)
        .returning({ id: bookAnalysis.id, analysisType: bookAnalysis.analysisType });

      // ── 2. Save individual quotes ────────────────────────────────────
      const quoteAnalysisId = inserted.find((r) => r.analysisType === "quote")?.id;
      if (quoteAnalysisId && Array.isArray(quoteList) && quoteList.length > 0) {
        await db.insert(quotes).values(
          quoteList.map((q) => ({
            bookId,
            analysisId: quoteAnalysisId,
            text: String(q.text ?? ""),
            context: String(q.context ?? ""),
            category: String(q.category ?? "insight"),
            score: Number(q.score ?? 0),
          }))
        ).catch((err) => {
          console.warn("[saveAnalysis] Failed to save quotes:", err);
        });
        savedCount++;
      }

      // ── 3. Save individual themes ────────────────────────────────────
      const themeAnalysisId = inserted.find((r) => r.analysisType === "theme")?.id;
      if (themeAnalysisId && Array.isArray(themesList) && themesList.length > 0) {
        await db.insert(themes).values(
          themesList.map((t) => ({
            bookId,
            analysisId: themeAnalysisId,
            name: String(t.name ?? ""),
            description: String(t.description ?? ""),
            weight: Number(t.weight ?? 0),
            evidence: { occurrences: Number(t.occurrences ?? 1) },
          }))
        ).catch((err) => {
          console.warn("[saveAnalysis] Failed to save themes:", err);
        });
        savedCount++;
      }

      savedCount++;
    } catch (err) {
      console.error("[saveAnalysis] Batch insert failed:", err);
    }
  }

  // ── 4. Update book status ─────────────────────────────────────────────
  const metadata = aggregatedResult.metadata ?? { chunkCount: 0, totalTokens: 0, processingTimeMs: 0, model: "unknown" };
  await db
    .update(books)
    .set({
      status: "completed",
      chunkCount: metadata.chunkCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId))
    .catch((err) => {
      console.warn("[saveAnalysis] Failed to update book status:", err);
    });

  console.log(`[saveAnalysis] Persisted ${savedCount} analysis types`);

  return {
    currentNode: "saveAnalysis",
    workflowStatus: "completed",
  };
}

/**
 * Fallback: save whatever partial results we have from individual agents
 * even if the aggregator didn't produce a combined result.
 */
async function savePartialResults(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const { bookId, workflowId } = state;

  // Try to build minimal analysis entries from raw agent results
  const entries: {
    bookId: string;
    workflowId: string;
    analysisType: string;
    result: Record<string, unknown>;
  }[] = [];

  if (state.summaries.length > 0) {
    entries.push({
      bookId,
      workflowId,
      analysisType: "summary",
      result: { summary: state.summaries.map((s) => s.summary).filter(Boolean).join("\n\n") },
    });
  }

  if (state.themes.length > 0) {
    const allThemes = state.themes.flatMap((t) => t.themes ?? []);
    if (allThemes.length > 0) {
      entries.push({
        bookId,
        workflowId,
        analysisType: "theme",
        result: { themes: allThemes },
      });
    }
  }

  if (entries.length > 0) {
    try {
      await db.insert(bookAnalysis).values(entries);
    } catch (err) {
      console.warn("[saveAnalysis] Failed to save partial results:", err);
    }
  }

  await db
    .update(books)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(books.id, bookId))
    .catch(() => {});

  return { currentNode: "saveAnalysis", workflowStatus: "completed" };
}
