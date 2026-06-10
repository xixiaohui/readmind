// ---------------------------------------------------------------------------
// WorkflowContext — Execution Environment for Workflow Nodes
// ---------------------------------------------------------------------------
//
// Each Node receives the State. But nodes also need access to:
//   - The database (to save intermediate results)
//   - The LLM client (to call OpenAI/DeepSeek)
//   - Checkpointing (to persist state after completing)
//   - Progress tracking (to report to mobile/web)
//
// WorkflowContext bundles all of these into a single object that
// is passed alongside the State to every Node.
//
// ## Design Principle: Separation of Concerns
//
//   State  = WHAT we're processing (data)
//   Context = HOW we process it (tools/infrastructure)
//
// Nodes should NOT:
//   - Import DB connection directly (use context.db)
//   - Create LLM clients directly (use context.llm)
//   - Call checkpoint functions directly (use context.saveCheckpoint)
//
// This makes nodes TESTABLE: inject a mock Context, and the node
// runs identically to production.
// ---------------------------------------------------------------------------

import { z } from "zod/v4";
import type { BookAnalysisStateType } from "./state";
import { saveCheckpoint, markWorkflowFailed } from "./checkpoint";

// ═══════════════════════════════════════════════════════════════════════════
// 1. LLM Client Interface
// ═══════════════════════════════════════════════════════════════════════════
//
// Abstract interface — allows swapping OpenAI / DeepSeek / Anthropic
// without changing any Node code.

export interface LLMClient {
  /** Send a chat completion request. Returns the response text. */
  chat(messages: LLMMessage[]): Promise<string>;

  /** Send a chat completion request with structured JSON output. Validates against the given Zod schema. */
  chatJSON<T>(messages: LLMMessage[], schema: z.ZodType<T>): Promise<T>;

  /** Generate embeddings for a list of texts. */
  embed(texts: string[]): Promise<number[][]>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Progress Emitter Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface ProgressEvent {
  workflowId: string;
  node: string;
  chunkIndex: number;
  totalChunks: number;
  status: "started" | "progress" | "completed" | "error";
  message?: string;
  timestamp: string;
}

export interface ProgressEmitter {
  emit(event: ProgressEvent): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Workflow Context
// ═══════════════════════════════════════════════════════════════════════════

export interface WorkflowContextOptions {
  llm: LLMClient;
  onProgress?: (event: ProgressEvent) => void;
}

export class WorkflowContext {
  readonly llm: LLMClient;
  private onProgress?: (event: ProgressEvent) => void;

  constructor(options: WorkflowContextOptions) {
    this.llm = options.llm;
    this.onProgress = options.onProgress;
  }

  // ── Checkpoint helpers ──────────────────────────────────────────────────

  /**
   * Saves a checkpoint after a node completes successfully.
   * Convenience wrapper around the checkpoint module.
   */
  async checkpoint(
    state: BookAnalysisStateType,
    nodeName: string,
    outputData?: Record<string, unknown>
  ): Promise<void> {
    await saveCheckpoint({
      workflowId: state.workflowId,
      state,
      nodeName,
      status: "completed",
      outputData,
    });
  }

  /**
   * Marks the workflow as failed and saves final state.
   */
  async fail(
    state: BookAnalysisStateType,
    nodeName: string,
    error: Error
  ): Promise<void> {
    await markWorkflowFailed({
      workflowId: state.workflowId,
      state,
      nodeName,
      error,
    });
  }

  // ── Progress helpers ────────────────────────────────────────────────────

  /**
   * Emits a progress event. If no listener is attached, this is a no-op.
   * In production, onProgress pushes events to SSE stream.
   */
  emitProgress(
    state: BookAnalysisStateType,
    status: "started" | "progress" | "completed" | "error",
    message?: string
  ): void {
    if (!this.onProgress) return;

    this.onProgress({
      workflowId: state.workflowId,
      node: state.currentNode,
      chunkIndex: state.currentChunkIndex,
      totalChunks: state.chunks.length,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // ── State helpers ───────────────────────────────────────────────────────

  /**
   * Advances to the next chunk and returns the chunk data.
   * Returns null if all chunks have been processed.
   *
   * This is the core iteration mechanism for agent nodes:
   *
   *   let chunk = context.nextChunk(state);
   *   while (chunk) {
   *     const result = await analyze(chunk);
   *     state.themes.push(result);
   *     chunk = context.nextChunk(state);
   *   }
   */
  nextChunk(state: BookAnalysisStateType): { content: string; index: number } | null {
    if (state.currentChunkIndex >= state.chunks.length) {
      return null;
    }

    const chunk = state.chunks[state.currentChunkIndex];
    if (!chunk) {
      return null;
    }

    state.currentChunk = chunk;
    state.currentChunkIndex += 1;
    return { content: chunk.content, index: chunk.index };
  }

  /**
   * Resets the chunk iterator for a new agent to start processing.
   * Each agent begins from chunk 0.
   */
  resetChunks(state: BookAnalysisStateType): void {
    state.currentChunkIndex = 0;
    state.currentChunk = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Workflow Runner
// ═══════════════════════════════════════════════════════════════════════════

export interface RunWorkflowParams {
  state: BookAnalysisStateType;
  context: WorkflowContext;
}

/**
 * The top-level function that runs the full workflow.
 * It invokes the LangGraph with the initial state and context.
 *
 * This function:
 *   1. Loads any existing checkpoint (for recovery)
 *   2. Creates the initial state if none exists
 *   3. Invokes the LangGraph with the state
 *   4. Returns the final state after all nodes complete
 */
export async function runWorkflow(params: RunWorkflowParams): Promise<BookAnalysisStateType> {
  const { state, context } = params;

  // Mark workflow as running
  const runningState: BookAnalysisStateType = {
    ...state,
    workflowStatus: "running",
    currentNode: "loadBook",
  };

  await saveCheckpoint({
    workflowId: runningState.workflowId,
    state: runningState,
    nodeName: "loadBook",
    status: "running",
  });

  context.emitProgress(runningState, "started", "Workflow started");

  // The actual LangGraph invocation will be wired in Step 5.
  // For now, this provides the execution contract.

  return runningState;
}
