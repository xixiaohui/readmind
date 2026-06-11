// ---------------------------------------------------------------------------
// Book Analysis Workflow — LangGraph StateGraph (Production)
// ---------------------------------------------------------------------------
//
// This is now a FACTORY function, not a static export.
//
// WHY FACTORY?
//   The graph needs a Checkpointer (PostgreSQL) to be production-ready.
//   Different environments (dev, test, production) inject different
//   checkpointers. Making it a factory with dependency injection means:
//     - Tests inject MemorySaver (fast, no DB dependency)
//     - Production injects PostgresCheckpointer (persistent, mobile-ready)
//     - The graph topology is identical in both cases
//
// Graph Topology:
//
//   START → loadBook → splitBook → embeddingChunks
//                                       │
//             ┌──────────┬──────────┬───┴────┬──────────┐
//             ▼          ▼          ▼        ▼          ▼
//       themeAnalyzer summary   quote     emotion
//             │       Analyzer  Extractor Analyzer
//             ▼          │          │        │
//       philosophy       │          │        │
//         Analyzer       │          │        │
//             │          │          │        │
//             └──────────┴──────────┴────────┘
//                        │
//                 aggregateResults
//                        │
//                    saveAnalysis
//                        │
//                       END
// ---------------------------------------------------------------------------

import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { BookAnalysisState } from "./state";
import { PostgresCheckpointer } from "./postgresCheckpointer";
import {
  loadBook,
  splitBook,
  embeddingChunks,
  themeAnalyzer,
  summaryAnalyzer,
  quoteExtractor,
  philosophyAnalyzer,
  emotionAnalyzer,
  aggregateResults,
  characterAnalyzer,
  psychologyAnalyzer,
  sociologyAnalyzer,
  politicalEconomyAnalyzer,
  literaryCriticAnalyzer,
  religiousAnalyzer,
  aggregateDeepResults,
  saveAnalysis,
} from "./nodes";

// ─── Graph Factory ──────────────────────────────────────────────────────────

export interface CreateGraphOptions {
  /** Checkpointer instance. Defaults to PostgresCheckpointer for production. */
  checkpointer?: BaseCheckpointSaver;
}

/**
 * Creates a compiled BookAnalysisWorkflow graph.
 *
 * Usage:
 *   // Production
 *   const graph = createBookAnalysisGraph();
 *
 *   // Testing
 *   const graph = createBookAnalysisGraph({ checkpointer: new MemorySaver() });
 */
export function createBookAnalysisGraph(options: CreateGraphOptions = {}) {
  const checkpointer = options.checkpointer ?? new PostgresCheckpointer();

  return new StateGraph(BookAnalysisState)
    // ── Register all nodes ──────────────────────────────────────────────────
    .addNode("loadBook", loadBook)
    .addNode("splitBook", splitBook)
    .addNode("embeddingChunks", embeddingChunks)
    .addNode("themeAnalyzer", themeAnalyzer)
    .addNode("summaryAnalyzer", summaryAnalyzer)
    .addNode("quoteExtractor", quoteExtractor)
    .addNode("philosophyAnalyzer", philosophyAnalyzer)
    .addNode("emotionAnalyzer", emotionAnalyzer)
    .addNode("aggregateResults", aggregateResults)
    .addNode("saveAnalysis", saveAnalysis)

    // ── Sequential chain ────────────────────────────────────────────────────
    .addEdge(START, "loadBook")
    .addEdge("loadBook", "splitBook")
    .addEdge("splitBook", "embeddingChunks")

    // ── Fan-out: 4 parallel analysis branches ───────────────────────────────
    .addEdge("embeddingChunks", "themeAnalyzer")
    .addEdge("embeddingChunks", "summaryAnalyzer")
    .addEdge("embeddingChunks", "quoteExtractor")
    .addEdge("embeddingChunks", "emotionAnalyzer")

    // ── Sequential within branch ────────────────────────────────────────────
    .addEdge("themeAnalyzer", "philosophyAnalyzer")

    // ── Fan-in: converge at aggregateResults ────────────────────────────────
    .addEdge("summaryAnalyzer", "aggregateResults")
    .addEdge("quoteExtractor", "aggregateResults")
    .addEdge("philosophyAnalyzer", "aggregateResults")
    .addEdge("emotionAnalyzer", "aggregateResults")

    // ── Phase 2: Deep Analysis — 6 agents in parallel, full-book context ───
    .addNode("characterAnalyzer", characterAnalyzer)
    .addNode("psychologyAnalyzer", psychologyAnalyzer)
    .addNode("sociologyAnalyzer", sociologyAnalyzer)
    .addNode("politicalEconomyAnalyzer", politicalEconomyAnalyzer)
    .addNode("literaryCriticAnalyzer", literaryCriticAnalyzer)
    .addNode("religiousAnalyzer", religiousAnalyzer)
    .addNode("aggregateDeepResults", aggregateDeepResults)

    // Fan-out from aggregateResults → 6 deep agents
    .addEdge("aggregateResults", "characterAnalyzer")
    .addEdge("aggregateResults", "psychologyAnalyzer")
    .addEdge("aggregateResults", "sociologyAnalyzer")
    .addEdge("aggregateResults", "politicalEconomyAnalyzer")
    .addEdge("aggregateResults", "literaryCriticAnalyzer")
    .addEdge("aggregateResults", "religiousAnalyzer")

    // Fan-in: converge at aggregateDeepResults
    .addEdge("characterAnalyzer", "aggregateDeepResults")
    .addEdge("psychologyAnalyzer", "aggregateDeepResults")
    .addEdge("sociologyAnalyzer", "aggregateDeepResults")
    .addEdge("politicalEconomyAnalyzer", "aggregateDeepResults")
    .addEdge("literaryCriticAnalyzer", "aggregateDeepResults")
    .addEdge("religiousAnalyzer", "aggregateDeepResults")

    // ── Final chain ─────────────────────────────────────────────────────────
    .addEdge("aggregateDeepResults", "saveAnalysis")
    .addEdge("saveAnalysis", END)

    // ── Compile with checkpointer ───────────────────────────────────────────
    .compile({
      checkpointer,
    });
}

// ─── Default Instance (for convenience) ─────────────────────────────────────

/**
 * The default production graph instance.
 * Uses PostgresCheckpointer for persistent state storage.
 */
export const bookAnalysisGraph = createBookAnalysisGraph();

// ─── Type Export ────────────────────────────────────────────────────────────

export type BookAnalysisGraph = ReturnType<typeof createBookAnalysisGraph>;
