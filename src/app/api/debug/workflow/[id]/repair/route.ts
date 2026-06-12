// ---------------------------------------------------------------------------
// POST /api/debug/workflow/[id]/repair
// ---------------------------------------------------------------------------
// Repair a workflow with inconsistent state.
// Only works in development mode.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { workflowRuns, workflowSteps, bookAnalysis, quotes, themes, books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { loadCheckpoint } from "@/lib/workflow/checkpoint";
import { savePartialResults } from "@/lib/workflow/nodes/saveAnalysis";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Debug endpoints only available in development" },
      { status: 403 }
    );
  }

  const { id: workflowId } = await params;

  try {
    // 1. Load the state snapshot
    const checkpoint = await loadCheckpoint(workflowId, { useCache: false });

    if (!checkpoint || !checkpoint.state) {
      return NextResponse.json(
        { error: "No state snapshot found for this workflow" },
        { status: 404 }
      );
    }

    const state = checkpoint.state;
    const bookId = state.bookId;
    const chunksTotal = state.chunks?.length ?? 0;
    const currentChunkIndex = state.currentChunkIndex ?? 0;

    // 2. Calculate what the correct status should be
    const hasData =
      (state.themes && state.themes.length > 0) ||
      (state.summaries && state.summaries.length > 0);

    const shouldBeCompleted = hasData && currentChunkIndex >= chunksTotal - 1;

    // 3. Get current workflow record
    const [workflow] = await db
      .select({
        id: workflowRuns.id,
        status: workflowRuns.status,
        currentNode: workflowRuns.currentNode,
        currentChunkIndex: workflowRuns.currentChunkIndex,
        progress: workflowRuns.progress,
        bookId: workflowRuns.bookId,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.id, workflowId))
      .limit(1);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // 4. Check if analysis results are already saved
    const existingAnalyses = await db
      .select({ id: bookAnalysis.id, analysisType: bookAnalysis.analysisType })
      .from(bookAnalysis)
      .where(eq(bookAnalysis.workflowId, workflowId));

    const needsSave = existingAnalyses.length === 0 && hasData;

    // 5. Save analysis results if needed
    let savedAnalyses = 0;
    let savedQuotes = 0;
    let savedThemes = 0;

    if (needsSave) {
      try {
        console.log(`[Repair] Saving analysis results for workflow ${workflowId}`);

        // Use the existing savePartialResults function
        // But we need to adapt it to also return what was saved
        const result = await savePartialResultsAndTrack(state);

        savedAnalyses = result.analyses;
        savedQuotes = result.quotes;
        savedThemes = result.themes;

        console.log(`[Repair] Saved ${savedAnalyses} analyses, ${savedQuotes} quotes, ${savedThemes} themes`);
      } catch (err) {
        console.error(`[Repair] Failed to save analysis results:`, err);
        return NextResponse.json(
          {
            error: "Failed to save analysis results",
            details: err instanceof Error ? err.message : String(err),
          },
          { status: 500 }
        );
      }
    }

    // 6. Check if repair is needed for workflow status
    const needsStatusRepair =
      workflow.status !== "completed" &&
      shouldBeCompleted;

    let statusRepaired = false;

    if (needsStatusRepair) {
      // Repair the workflow
      const updateResult = await db
        .update(workflowRuns)
        .set({
          status: "completed",
          currentNode: "END",
          currentChunkIndex: chunksTotal,
          progress: 1.0,
          completedAt: new Date(),
        })
        .where(eq(workflowRuns.id, workflowId))
        .returning({
          id: workflowRuns.id,
          status: workflowRuns.status,
          currentNode: workflowRuns.currentNode,
          progress: workflowRuns.progress,
        });

      // Also ensure we have at least one completed step for each major node
      const existingSteps = await db
        .select({ nodeName: workflowSteps.nodeName })
        .from(workflowSteps)
        .where(eq(workflowSteps.workflowId, workflowId));

      const existingNodeNames = new Set(existingSteps.map(s => s.nodeName));
      const requiredNodes = ["init", "loadBook", "splitBook", "themeAnalyzer"];

      for (const nodeName of requiredNodes) {
        if (!existingNodeNames.has(nodeName)) {
          await db.insert(workflowSteps).values({
            workflowId,
            nodeName,
            status: "completed",
            startedAt: new Date(),
            completedAt: new Date(),
          });
        }
      }

      statusRepaired = true;

      // Update book status
      await db
        .update(books)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(books.id, bookId))
        .catch((err) => {
          console.warn("[Repair] Failed to update book status:", err);
        });

      // 7. Return result
      return NextResponse.json({
        message: "Workflow repaired successfully",
        repairs: {
          status: statusRepaired ? "repaired" : "not_needed",
          analysisSaved: needsSave ? "saved" : "already_exists",
          savedAnalyses,
          savedQuotes,
          savedThemes,
        },
        before: {
          status: workflow.status,
          progress: workflow.progress,
          currentNode: workflow.currentNode,
        },
        after: updateResult[0],
        state: {
          chunksTotal,
          currentChunkIndex,
          hasData,
        },
      });
    }

    return NextResponse.json({
      message: "No repair needed or analysis already saved",
      repairs: {
        status: "not_needed",
        analysisSaved: needsSave ? "saved" : "already_exists",
        savedAnalyses,
        savedQuotes,
        savedThemes,
      },
      current: {
        status: workflow.status,
        progress: workflow.progress,
        currentNode: workflow.currentNode,
      },
      state: {
        chunksTotal,
        currentChunkIndex,
        hasData,
        existingAnalyses: existingAnalyses.length,
      },
    });

  } catch (err) {
    console.error(`[Repair] Failed to repair workflow ${workflowId}:`, err);
    return NextResponse.json(
      {
        error: "Failed to repair workflow",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * Wrapper around savePartialResults that also tracks what was saved.
 */
async function savePartialResultsAndTrack(state: any) {
  const { bookId, workflowId } = state;

  // Check what data exists
  const hasThemes = state.themes && state.themes.length > 0;
  const hasSummaries = state.summaries && state.summaries.length > 0;
  const hasQuotes = state.quotes && state.quotes.length > 0;

  let savedAnalyses = 0;
  let savedQuotes = 0;
  let savedThemes = 0;

  // Build analysis entries
  const entries: {
    bookId: string;
    workflowId: string;
    analysisType: string;
    result: Record<string, unknown>;
  }[] = [];

  if (hasSummaries) {
    const summary = state.summaries.map((s: any) => s.summary).filter(Boolean).join("\n\n");
    if (summary) {
      entries.push({
        bookId,
        workflowId,
        analysisType: "summary",
        result: { summary },
      });
    }
  }

  if (hasThemes) {
    const allThemes = state.themes.flatMap((t: any) => t.themes ?? []);
    if (allThemes.length > 0) {
      entries.push({
        bookId,
        workflowId,
        analysisType: "theme",
        result: { themes: allThemes },
      });
    }
  }

  if (hasQuotes) {
    const allQuotes = state.quotes.flatMap((q: any) => q.quotes ?? []);
    if (allQuotes.length > 0) {
      entries.push({
        bookId,
        workflowId,
        analysisType: "quote",
        result: { quotes: allQuotes },
      });
    }
  }

  if (entries.length > 0) {
    try {
      const inserted = await db
        .insert(bookAnalysis)
        .values(entries)
        .returning({ id: bookAnalysis.id, analysisType: bookAnalysis.analysisType });

      savedAnalyses = inserted.length;

      // Save individual quotes
      const quoteAnalysisId = inserted.find((r) => r.analysisType === "quote")?.id;
      if (quoteAnalysisId && hasQuotes) {
        const allQuotes = state.quotes.flatMap((q: any) => q.quotes ?? []);
        await db.insert(quotes).values(
          allQuotes.map((q: any) => ({
            bookId,
            analysisId: quoteAnalysisId,
            text: String(q.text ?? ""),
            context: String(q.context ?? ""),
            category: String(q.category ?? "insight"),
            score: Number(q.score ?? 0),
          }))
        ).catch((err) => {
          console.warn("[Repair] Failed to save quotes:", err);
        });
        savedQuotes = allQuotes.length;
      }

      // Save individual themes
      const themeAnalysisId = inserted.find((r) => r.analysisType === "theme")?.id;
      if (themeAnalysisId && hasThemes) {
        const allThemes = state.themes.flatMap((t: any) => t.themes ?? []);
        await db.insert(themes).values(
          allThemes.map((t: any) => ({
            bookId,
            analysisId: themeAnalysisId,
            name: String(t.name ?? ""),
            description: String(t.description ?? ""),
            weight: Number(t.weight ?? 0),
            evidence: { occurrences: Number(t.occurrences ?? 1) },
          }))
        ).catch((err) => {
          console.warn("[Repair] Failed to save themes:", err);
        });
        savedThemes = allThemes.length;
      }

    } catch (err) {
      console.error("[Repair] Failed to save analysis entries:", err);
      throw err;
    }
  }

  // Update book status
  await db
    .update(books)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(books.id, bookId))
    .catch(() => {});

  return { analyses: savedAnalyses, quotes: savedQuotes, themes: savedThemes };
}
