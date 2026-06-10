// ---------------------------------------------------------------------------
// Shared Workflow Trigger — Fire-and-Forget Execution
// ---------------------------------------------------------------------------
// Used by both upload (auto-trigger) and analyze (manual retry) routes.
//
// Creates a LangGraph instance, invokes it asynchronously (not awaited),
// and handles completion/failure with progress events and checkpoint saves.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { workflowRuns, books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createInitialState, createBookAnalysisGraph } from "@/lib/workflow";
import { saveCheckpoint, loadCheckpoint } from "@/lib/workflow/checkpoint";
import { progressEmitter } from "@/lib/api/progress";
import type { BookAnalysisStateType } from "@/lib/workflow/state";

export interface TriggerWorkflowParams {
  bookId: string;
  userId: string;
  title: string;
}

export interface TriggerWorkflowResult {
  workflowId: string;
}

/**
 * Creates a workflow record, builds the initial state, saves a checkpoint,
 * and fires the LangGraph workflow in the background (fire-and-forget).
 *
 * Returns the workflowId immediately — the caller does NOT wait for
 * the analysis to complete.
 */
export async function triggerWorkflow(
  params: TriggerWorkflowParams
): Promise<TriggerWorkflowResult> {
  const { bookId, userId, title } = params;

  // 1. Create workflow record (status: pending — transitions to running
  //    once the loadBook node completes and saves its checkpoint)
  const [workflow] = await db
    .insert(workflowRuns)
    .values({
      bookId,
      userId,
      status: "pending",
    })
    .returning({ id: workflowRuns.id });

  if (!workflow) {
    throw new Error("Failed to create workflow record");
  }

  const workflowId = workflow.id;

  // 2. Build initial state (rawText is empty — loadBook node fetches it from DB)
  const state = createInitialState({
    workflowId,
    userId,
    bookId,
    title,
    rawText: "",
  });

  // 3. Save initial checkpoint so the workflow is visible immediately
  await saveCheckpoint({
    workflowId,
    state: { ...state, workflowStatus: "running" },
    nodeName: "init",
    status: "running",
  });

  // 4. Fire-and-forget: do not await
  runInBackground(state);

  return { workflowId };
}

/**
 * Invokes the LangGraph workflow in the background.
 * Progress events are emitted to the SSE system.
 * Final state is persisted via saveCheckpoint on completion/failure.
 */
function runInBackground(state: BookAnalysisStateType): void {
  const graph = createBookAnalysisGraph();

  graph
    .invoke(state, {
      configurable: { thread_id: state.workflowId },
    })
    .then(async (result) => {
      progressEmitter.emit({
        workflowId: state.workflowId,
        node: "END",
        chunkIndex: 0,
        totalChunks: 0,
        status: "completed",
        message: "Analysis complete",
        timestamp: new Date().toISOString(),
      });

      const finalState = result as unknown as BookAnalysisStateType;
      await saveCheckpoint({
        workflowId: state.workflowId,
        state: { ...finalState, workflowStatus: "completed" },
        nodeName: "END",
        status: "completed",
      });

      progressEmitter.cleanup(state.workflowId);
    })
    .catch(async (err) => {
      const workflowId = state.workflowId;
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      const errorStack =
        err instanceof Error ? err.stack : undefined;

      console.error(
        `[Workflow] ${workflowId} failed:`,
        errorMessage,
        errorStack ? `\n${errorStack}` : ""
      );

      // ── Preserve the LAST successful checkpoint state ──────────────────
      // LangGraph's PostgresCheckpointer saved state after each node.
      // Load that state instead of using the stale closure `state`.
      const checkpoint = await loadCheckpoint(workflowId).catch(() => null);
      const lastNode =
        checkpoint?.lastNode && checkpoint.lastNode !== "init"
          ? checkpoint.lastNode
          : "unknown";

      // Save failure checkpoint WITHOUT overwriting the last good state
      await saveCheckpoint({
        workflowId,
        state: checkpoint?.state ?? state,
        nodeName: lastNode,
        status: "failed",
        error: errorMessage,
      }).catch((saveErr) => {
        console.error(`[Workflow] Failed to save failure checkpoint:`, saveErr);
      });

      // Update workflow record with error details for frontend display
      await db
        .update(workflowRuns)
        .set({
          status: "failed",
          currentNode: lastNode,
          errors: [
            {
              node: lastNode,
              message: errorMessage,
              timestamp: new Date().toISOString(),
              retryable: true,
            },
          ],
          completedAt: new Date(),
        })
        .where(eq(workflowRuns.id, workflowId))
        .catch(() => {});

      progressEmitter.emit({
        workflowId,
        node: lastNode,
        chunkIndex: 0,
        totalChunks: 0,
        status: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });

      progressEmitter.cleanup(workflowId);

      // Update book status so the frontend can show retry UI
      await db
        .update(books)
        .set({ status: "failed" })
        .where(eq(books.id, state.bookId))
        .catch(() => {});
    });
}
