// ---------------------------------------------------------------------------
// Workflow Runner — End-to-End Execution Orchestrator
// ---------------------------------------------------------------------------
//
// This is the ENTRY POINT for running a Book Analysis Workflow.
// It ties together all the pieces built in Steps 1-5:
//
//   1. Create initial State (step 4)
//   2. Save "pending" checkpoint to PostgreSQL (step 3 + 4)
//   3. Invoke LangGraph with PostgresCheckpointer (step 5)
//   4. Graph auto-saves checkpoints after each Node (step 4)
//   5. Return final state or throw with error details
//
// ## The Closed Loop
//
//   API Route (POST /api/books/analyze)
//        │
//        ▼
//   runBookAnalysisWorkflow({ workflowId, userId, bookId })
//        │
//        ├── createInitialState()           ← state.ts
//        ├── saveCheckpoint({status:pending}) ← checkpoint.ts
//        │
//        ├── graph.invoke(state, config)    ← graph.ts
//        │     │
//        │     ├── Node: loadBook           ← reads from DB
//        │     │    └── put() → checkpoint  ← postgresCheckpointer.ts
//        │     │
//        │     ├── Node: splitBook          ← text splitting
//        │     │    └── put() → checkpoint
//        │     │
//        │     └── ... (remaining nodes)
//        │
//        └── loadCheckpoint()               ← checkpoint.ts
//             └── Get final state from DB
//
// ## Recovery Scenario
//
//   If the server crashes during themeAnalyzer:
//     1. The last checkpoint (from splitBook or embeddingChunks) is in DB
//     2. On restart, call loadCheckpoint(workflowId)
//     3. Feed the recovered state back to graph.invoke()
//     4. LangGraph resumes from the checkpoint
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from "uuid";
import { createInitialState, type BookAnalysisStateType } from "./state";
import { saveCheckpoint, loadCheckpoint } from "./checkpoint";
import { createBookAnalysisGraph } from "./graph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

// ═══════════════════════════════════════════════════════════════════════════
// Run Workflow
// ═══════════════════════════════════════════════════════════════════════════

export interface RunWorkflowParams {
  /** Existing workflowId (for resume) or undefined (new workflow) */
  workflowId?: string;
  userId: string;
  bookId: string;
  /** Optional checkpointer override (testing) */
  checkpointer?: BaseCheckpointSaver;
}

export interface RunWorkflowResult {
  workflowId: string;
  finalState: BookAnalysisStateType;
  recovered: boolean;
}

/**
 * Runs the full Book Analysis Workflow.
 *
 * If a workflowId is provided AND a checkpoint exists, the workflow
 * resumes from the last checkpoint (recovery mode).
 *
 * Otherwise, a new workflow is created and run from scratch.
 */
export async function runBookAnalysisWorkflow(
  params: RunWorkflowParams
): Promise<RunWorkflowResult> {
  const { workflowId: existingId, userId, bookId, checkpointer } = params;

  // ── Recovery: try to resume from existing checkpoint ────────────────────
  let state: BookAnalysisStateType;
  let recovered = false;

  if (existingId) {
    const checkpoint = await loadCheckpoint(existingId);
    if (checkpoint) {
      state = checkpoint.state;
      recovered = true;
      console.log(
        `[Runner] Resuming workflow ${existingId} from node "${checkpoint.lastNode}"`
      );
    } else {
      // Workflow ID provided but no checkpoint — start fresh
      state = createInitialState({
        workflowId: existingId,
        userId,
        bookId,
        title: "", // will be populated by loadBook
        rawText: "", // will be populated by loadBook
      });
    }
  } else {
    // ── New workflow ──────────────────────────────────────────────────────
    const newId = uuidv4();
    state = createInitialState({
      workflowId: newId,
      userId,
      bookId,
      title: "",
      rawText: "",
    });
  }

  // ── Save initial state to DB ────────────────────────────────────────────
  await saveCheckpoint({
    workflowId: state.workflowId,
    state,
    nodeName: "init",
    status: "running",
  });

  // ── Create graph and invoke ─────────────────────────────────────────────
  const graph = createBookAnalysisGraph({ checkpointer });

  try {
    const result = await graph.invoke(state, {
      configurable: {
        thread_id: state.workflowId,
      },
    });

    // ── Load final state from DB (graph.invoke returns partial) ───────────
    const finalCheckpoint = await loadCheckpoint(state.workflowId);
    const finalState = finalCheckpoint?.state ?? (result as unknown as BookAnalysisStateType);

    return {
      workflowId: state.workflowId,
      finalState,
      recovered,
    };
  } catch (error) {
    // Workflow failed — the checkpointer has already saved the last
    // successful state. The error is logged for debugging.
    console.error(
      `[Runner] Workflow ${state.workflowId} failed:`,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
