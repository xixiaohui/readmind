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

  // Calculate total token count across all chunks
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  // Get the model from environment config
  const model = process.env.AI_MODEL ?? "deepseek-chat";

  const aggregatedResult = await aggregateAll({
    bookId,
    workflowId,
    title,
    themeResults: themes,
    summaryResults: summaries,
    quoteResults: quotes,
    philosophyResults: philosophy,
    emotionResults: emotions,
    chunkCount: chunks.length,
    totalTokens,
    processingStartTime: Date.now(),
    model,
  });

  return {
    aggregatedResult,
    currentNode: "aggregateResults",
  };
}
