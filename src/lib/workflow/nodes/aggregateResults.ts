// ---------------------------------------------------------------------------
// Node: aggregateResults — REDUCE Phase
// ---------------------------------------------------------------------------
// Aggregates per-chunk analysis from all 5 agents into a single,
// coherent analysis for the entire book.
//
// This is the REDUCE phase of Map-Reduce.
//
// This node WAITS for ALL parallel branches to complete:
//   summaryAnalyzer, quoteExtractor, philosophyAnalyzer, emotionAnalyzer
// (themeAnalyzer feeds into philosophyAnalyzer, so it's implicitly done)
//
// After this node, state.aggregatedResult contains the full AggregatedAnalysis.
// ---------------------------------------------------------------------------

import { aggregateAll } from "@/lib/pipeline/aggregator";
import type { BookAnalysisStateType } from "../state";

export async function aggregateResults(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const { bookId, workflowId, title, themes, summaries, quotes, philosophy, emotions, chunks } =
    state;

  try {
    // Calculate total token count across all chunks
    const totalTokens = (chunks ?? []).reduce((sum, c) => sum + (c?.tokenCount ?? 0), 0);

    // Get the model from environment config
    const model = process.env.AI_MODEL ?? "deepseek-chat";

    const aggregatedResult = await aggregateAll({
      bookId,
      workflowId,
      title,
      themeResults: themes ?? [],
      summaryResults: summaries ?? [],
      quoteResults: quotes ?? [],
      philosophyResults: philosophy ?? [],
      emotionResults: emotions ?? [],
      chunkCount: chunks?.length ?? 0,
      totalTokens,
      processingStartTime: Date.now(),
      model,
    });

    return {
      aggregatedResult,
      currentNode: "aggregateResults",
    };
  } catch (err) {
    // If the aggregator itself crashes, return a minimal result
    console.error("[aggregateResults] Aggregation failed:", err);
    const fallback = buildFallbackResult(state);
    return {
      aggregatedResult: fallback,
      currentNode: "aggregateResults",
    };
  }
}

function buildFallbackResult(state: BookAnalysisStateType) {
  return {
    bookId: state.bookId,
    workflowId: state.workflowId,
    title: state.title,
    themes: state.themes?.flatMap((t) => t.themes ?? []).slice(0, 10).map((t) => ({
      name: t.name ?? "Unknown",
      description: t.description ?? "",
      weight: t.weight ?? 0.5,
      occurrences: 1,
    })) ?? [],
    summary: state.summaries?.map((s) => s.summary).filter(Boolean).join("\n\n") ?? "",
    topQuotes: state.quotes?.flatMap((q) => q.quotes ?? []).slice(0, 20).map((q) => ({
      text: q.text ?? "",
      context: q.context ?? "",
      category: q.category ?? "insight" as const,
      score: q.score ?? 0.5,
    })) ?? [],
    philosophy: {
      primaryFrameworks: state.philosophy?.flatMap((p) => p.frameworks ?? []).slice(0, 5).map((f) => ({
        name: f.name ?? "Unknown",
        description: f.description ?? "",
        confidence: f.confidence ?? 0.5,
        relatedThemes: f.relatedThemes ?? [],
      })) ?? [],
      argumentSummary: "",
    },
    emotions: {
      overallTone: state.emotions?.find((e) => e.overallTone)?.overallTone ?? "Neutral",
      emotionArc: [],
      valenceDistribution: {},
    },
    metadata: {
      chunkCount: state.chunks?.length ?? 0,
      totalTokens: state.chunks?.reduce((sum, c) => sum + (c?.tokenCount ?? 0), 0) ?? 0,
      processingTimeMs: 0,
      model: process.env.AI_MODEL ?? "unknown",
    },
  };
}
