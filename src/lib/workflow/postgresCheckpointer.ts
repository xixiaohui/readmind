// ---------------------------------------------------------------------------
// PostgresCheckpointer — LangGraph Checkpoint Persistence in PostgreSQL
// ---------------------------------------------------------------------------
//
// Implements LangGraph's BaseCheckpointSaver interface using our existing
// workflow_runs table as the backing store.
//
// ## Architecture
//
//   LangGraph Graph Execution
//         │
//         ├── Node starts
//         │     └── putWrites() → stores pending writes (in-memory)
//         │
//         ├── Node completes
//         │     └── put() → saves checkpoint snapshot (PostgreSQL)
//         │
//         └── Crash / Resume
//               └── getTuple() → loads last checkpoint (PostgreSQL)
//
// ## Storage Mapping
//
//   LangGraph Concept        →  Our PostgreSQL
//   ─────────────────────       ──────────────
//   thread_id                →  workflow_runs.id
//   checkpoint.channel_values →  workflow_runs.state_snapshot (JSONB)
//   checkpoint.id            →  workflow_runs.checkpoint_id
//   checkpoint.ts            →  workflow_runs.updated_at
//   metadata                 →  workflow_runs (status, progress, etc.)
//   pending writes           →  in-memory Map (transient, rebuilt on recovery)
//
// ## Why In-Memory Writes?
//
// Pending writes represent work-in-progress within a single graph invocation.
// They are small, transient, and only needed during active execution.
// If the server crashes:
//   1. The last successful checkpoint is in PostgreSQL
//   2. The graph resumes from that checkpoint
//   3. New pending writes are generated
// This avoids unnecessary DB writes for transient data.
// ---------------------------------------------------------------------------

import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type {
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  CheckpointListOptions,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import { db } from "@/lib/db/connection";
import { workflowRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// PostgresCheckpointer
// ═══════════════════════════════════════════════════════════════════════════

export class PostgresCheckpointer extends BaseCheckpointSaver {
  /**
   * In-memory storage for pending writes.
   * Key format: `${threadId}:${checkpointNs}:${taskId}`
   */
  private _writes: Map<string, PendingWrite[]> = new Map();

  constructor() {
    // Use default JSON serializer (our state is JSON-serializable)
    super();
  }

  // ── getTuple: Load the latest checkpoint ─────────────────────────────────

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string;
    if (!threadId) return undefined;

    const rows = await db
      .select({
        stateSnapshot: workflowRuns.stateSnapshot,
        checkpointId: workflowRuns.checkpointId,
        updatedAt: workflowRuns.updatedAt,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.id, threadId))
      .limit(1);

    const row = rows[0];
    if (!row?.stateSnapshot) return undefined;

    // Reconstruct LangGraph Checkpoint from our JSONB
    const checkpoint: Checkpoint = {
      v: 4, // current checkpoint format version
      id: row.checkpointId ?? threadId,
      ts: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      channel_values: row.stateSnapshot as Record<string, unknown>,
      channel_versions: {}, // populated by LangGraph during execution
      versions_seen: {},
    };

    // Load pending writes from memory (may be empty if just recovered)
    const pendingWrites = this._getWrites(threadId, config.configurable?.checkpoint_ns ?? "");

    return {
      config,
      checkpoint,
      parentConfig: undefined,
      pendingWrites: pendingWrites.length > 0 ? pendingWrites.map(w => ["recovery", w[0], w[1]] as const) : undefined,
      metadata: {
        source: "loop",
        step: 0,
        parents: {},
      },
    };
  }

  // ── list: Enumerate checkpoints ──────────────────────────────────────────

  async *list(
    config: RunnableConfig,
    _options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const tuple = await this.getTuple(config);
    if (tuple) yield tuple;
  }

  // ── put: Save a checkpoint ──────────────────────────────────────────────

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    if (!threadId) {
      throw new Error("thread_id is required in config.configurable");
    }

    // Persist checkpoint to PostgreSQL
    await db
      .update(workflowRuns)
      .set({
        stateSnapshot: checkpoint.channel_values as Record<string, unknown>,
        checkpointId: checkpoint.id,
        updatedAt: new Date(),
        // If this is a "loop" source checkpoint, update progress
        ...(metadata.source === "loop" && {
          currentNode: threadId, // will be overwritten by our own checkpoint system
        }),
      })
      .where(eq(workflowRuns.id, threadId));

    // Clean up pending writes for completed tasks
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";
    this._clearWrites(threadId, checkpointNs);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  // ── putWrites: Store intermediate writes ─────────────────────────────────

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    _taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";
    const key = `${threadId}:${checkpointNs}`;

    const existing = this._writes.get(key) ?? [];
    // Add writes, deduplicating by channel
    for (const write of writes) {
      const channel = write[0];
      const idx = existing.findIndex((w) => w[0] === channel);
      if (idx >= 0) {
        existing[idx] = write;
      } else {
        existing.push(write);
      }
    }
    this._writes.set(key, existing);
  }

  // ── deleteThread: Clean up all data for a thread ─────────────────────────

  async deleteThread(threadId: string): Promise<void> {
    // Clear in-memory writes
    for (const key of this._writes.keys()) {
      if (key.startsWith(`${threadId}:`)) {
        this._writes.delete(key);
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _getWrites(threadId: string, checkpointNs: string): PendingWrite[] {
    const key = `${threadId}:${checkpointNs}`;
    return this._writes.get(key) ?? [];
  }

  private _clearWrites(threadId: string, checkpointNs: string): void {
    const key = `${threadId}:${checkpointNs}`;
    this._writes.delete(key);
  }
}
