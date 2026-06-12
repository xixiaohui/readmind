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

// ══════════════════════════════════════════════════════════════════════════
// Cache Layer — Simple in-memory cache for checkpoints and step history
// ══════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const checkpointCache = new Map<string, CacheEntry<LoadCheckpointResult>>();
const stepHistoryCache = new Map<string, CacheEntry<StepHistoryEntry[]>>();
const CACHE_TTL = 30 * 1000; // 30 seconds TTL

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(cache: Map<unknown>, key: string): void {
  cache.delete(key);
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Save Checkpoint
// ══════════════════════════════════════════════════════════════════════════

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
 * Two writes (WRAPPED IN TRANSACTION):
 *   1. workflow_runs: update state_snapshot + progress + currentNode
 *   2. workflow_steps: insert audit log entry
 *
 * IMPORTANT: Both writes must succeed or both must fail (transaction).
 * This prevents the inconsistency where state is saved but steps are missing.
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

  console.log(`[Checkpoint] Saving checkpoint for ${workflowId}/${nodeName}`, {
    status,
    progress,
    currentChunkIndex: state.currentChunkIndex,
    chunksCount: state.chunks.length,
  });

  try {
    // Use a transaction to ensure both writes succeed or both fail
    await db.transaction(async (tx) => {
      // 1. Update workflow_runs (current state + progress)
      const updateResult = await tx
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
        .where(eq(workflowRuns.id, workflowId))
        .returning({ id: workflowRuns.id });

      if (updateResult.length === 0) {
        throw new Error(`workflow_runs update affected 0 rows for ${workflowId}`);
      }

      console.log(`[Checkpoint] workflow_runs updated for ${workflowId}/${nodeName}`);

      // 2. Insert workflow_steps (audit log)
      await tx.insert(workflowSteps).values({
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

      console.log(`[Checkpoint] workflow_steps inserted for ${workflowId}/${nodeName}`);
    });

    console.log(`[Checkpoint] ✓ Checkpoint saved successfully for ${workflowId}/${nodeName}`);

    // Invalidate caches
    invalidateCache(checkpointCache, workflowId);
    invalidateCache(stepHistoryCache, workflowId);

  } catch (err) {
    console.error(`[Checkpoint] ✗ Failed to save checkpoint for ${workflowId}/${nodeName}:`, err);
    throw err; // Re-throw to let caller handle
  }
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
 *
 * Supports optional caching to improve performance for frequent reads.
 */
export async function loadCheckpoint(
  workflowId: string,
  options?: { useCache?: boolean }
): Promise<LoadCheckpointResult | null> {
  // Try cache first
  if (options?.useCache !== false) {
    const cached = getCache(checkpointCache, workflowId);
    if (cached) return cached;
  }

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

  const result = {
    state,
    lastNode: record.currentNode ?? "",
    progress: record.progress ?? 0,
    recoveredAt: new Date(),
  };

  // Cache the result
  if (options?.useCache !== false) {
    setCache(checkpointCache, workflowId, result);
  }

  return result;
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
 *
 * Supports optional caching to improve performance for frequent reads.
 */
export async function getStepHistory(
  workflowId: string,
  options?: { useCache?: boolean }
): Promise<StepHistoryEntry[]> {
  // Try cache first
  if (options?.useCache !== false) {
    const cached = getCache(stepHistoryCache, workflowId);
    if (cached) return cached;
  }

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

  const result = rows.map((r) => ({
    nodeName: r.nodeName,
    status: r.status as StepStatus,
    error: r.error,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));

  // Cache the result
  if (options?.useCache !== false) {
    setCache(stepHistoryCache, workflowId, result);
  }

  return result;
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
