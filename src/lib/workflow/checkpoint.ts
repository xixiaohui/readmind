// ---------------------------------------------------------------------------
// Checkpoint Manager — State Persistence Layer
// ---------------------------------------------------------------------------
//
// ## Why Checkpoints Matter
//
// Without checkpoints, every failure means restarting from chunk 0.
// With checkpoints, we save the state after every Node, and resume
// from the last successful one.
//
// ## Checkpoint Strategy
//
//   After each Node completes:
//     1. Serialize state → JSON
//     2. Validate with Zod (catch corruption early)
//     3. UPSERT into workflow_runs.state_snapshot (JSONB)
//     4. Log step_attempt in workflow_steps
//
//   On recovery:
//     1. SELECT state_snapshot FROM workflow_runs WHERE id = ?
//     2. Validate with Zod
//     3. Feed state back into LangGraph
//     4. LangGraph resumes from the first uncompleted Node
//
// ## Storage Model
//
//   workflow_runs.state_snapshot = FULL state as JSONB
//     - This is the "source of truth" for recovery
//     - Always the most recent successful state
//
//   workflow_steps = PER-NODE log
//     - Immutable audit trail
//     - Used for debugging and progress display
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { workflowRuns, workflowSteps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  serializeState,
  deserializeState,
  validateState,
  calculateProgress,
  type BookAnalysisStateType,
} from "./state";
import type { StepStatus } from "@/lib/types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Save Checkpoint
// ═══════════════════════════════════════════════════════════════════════════

export interface SaveCheckpointParams {
  workflowId: string;
  state: BookAnalysisStateType;
  nodeName: string;
  status: StepStatus;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  error?: string;
}

/**
 * Saves a state snapshot to PostgreSQL after a Node completes.
 *
 * This is the SINGLE POINT of persistence for workflow state.
 * Every Node calls this after it finishes processing.
 *
 * Two writes:
 *   1. workflow_runs: update state_snapshot + progress + currentNode
 *   2. workflow_steps: insert audit log entry
 */
export async function saveCheckpoint(params: SaveCheckpointParams): Promise<void> {
  const { workflowId, state, nodeName, status, inputData, outputData, error } =
    params;

  // Validate state before saving — catch corruption before it hits the DB
  const validation = validateState(state);
  if (!validation.valid) {
    console.error(
      `[Checkpoint] State validation failed for ${workflowId}/${nodeName}:`,
      validation.errors
    );
    throw new Error(
      `State validation failed before checkpoint: ${validation.errors
        .map((e) => e.field)
        .join(", ")}`
    );
  }

  const progress = calculateProgress(state);
  const serialized = serializeState(state);

  // 1. Update workflow_runs (current state + progress)
  await db
    .update(workflowRuns)
    .set({
      stateSnapshot: serialized,
      currentNode: nodeName,
      currentChunkIndex: state.currentChunkIndex,
      progress,
      status: state.workflowStatus,
      retryCount: state.retryCount,
      errors: state.errors.length > 0 ? state.errors : null,
      ...(status === "running" && { startedAt: new Date() }),
      ...(status === "completed" || status === "failed"
        ? { completedAt: new Date() }
        : {}),
    })
    .where(eq(workflowRuns.id, workflowId));

  // 2. Insert workflow_steps (audit log)
  await db.insert(workflowSteps).values({
    workflowId,
    nodeName,
    status,
    inputData,
    outputData,
    error,
    startedAt: status === "running" ? new Date() : undefined,
    completedAt:
      status === "completed" || status === "failed" ? new Date() : undefined,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Load Checkpoint
// ═══════════════════════════════════════════════════════════════════════════

export interface LoadCheckpointResult {
  state: BookAnalysisStateType;
  lastNode: string;
  progress: number;
  recoveredAt: Date;
}

/**
 * Loads the most recent state snapshot for a workflow.
 * Used for recovery after crash, or for mobile app to query progress.
 *
 * Returns null if no checkpoint exists (first run).
 */
export async function loadCheckpoint(
  workflowId: string
): Promise<LoadCheckpointResult | null> {
  const row = await db
    .select({
      stateSnapshot: workflowRuns.stateSnapshot,
      currentNode: workflowRuns.currentNode,
      progress: workflowRuns.progress,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflowId))
    .limit(1);

  const record = row[0];
  if (!record?.stateSnapshot) {
    return null;
  }

  const state = deserializeState(record.stateSnapshot);

  return {
    state,
    lastNode: record.currentNode ?? "",
    progress: record.progress ?? 0,
    recoveredAt: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Get Step History
// ═══════════════════════════════════════════════════════════════════════════

export interface StepHistoryEntry {
  nodeName: string;
  status: StepStatus;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

/**
 * Returns the audit log for a workflow — all step attempts in order.
 * Used by the Progress UI to show [✓] / [ ] / [✗] for each node.
 */
export async function getStepHistory(
  workflowId: string
): Promise<StepHistoryEntry[]> {
  const rows = await db
    .select({
      nodeName: workflowSteps.nodeName,
      status: workflowSteps.status,
      error: workflowSteps.error,
      startedAt: workflowSteps.startedAt,
      completedAt: workflowSteps.completedAt,
    })
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowId, workflowId))
    .orderBy(workflowSteps.createdAt);

  return rows.map((r) => ({
    nodeName: r.nodeName,
    status: r.status as StepStatus,
    error: r.error,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Mark Workflow Failed
// ═══════════════════════════════════════════════════════════════════════════

export interface MarkFailedParams {
  workflowId: string;
  state: BookAnalysisStateType;
  nodeName: string;
  error: Error;
}

/**
 * Marks a workflow as failed and saves the final state.
 * The error is stored so users can see WHAT failed and WHERE.
 */
export async function markWorkflowFailed(params: MarkFailedParams): Promise<void> {
  const { workflowId, state, nodeName, error } = params;

  const failedState: BookAnalysisStateType = {
    ...state,
    workflowStatus: "failed",
    currentNode: nodeName,
    errors: [
      ...state.errors,
      {
        node: nodeName,
        chunkIndex: state.currentChunkIndex,
        message: error.message,
        timestamp: new Date().toISOString(),
        retryable: true,
      },
    ],
  };

  await saveCheckpoint({
    workflowId,
    state: failedState,
    nodeName,
    status: "failed",
    error: error.message,
  });
}
