// ---------------------------------------------------------------------------
// Base Agent Runner — Common Pattern for All Agents
// ---------------------------------------------------------------------------
//
// Every Agent Node follows the same pattern:
//
//   1. Iterate over state.chunks
//   2. For each chunk: build prompt → call LLM → parse JSON → accumulate
//   3. Return accumulated results
//
// This base runner encapsulates the iteration and error handling,
// so each specific Agent only defines its prompt and output shape.
//
// ## Design: Why a base function instead of a class?
//
// In LangGraph, nodes are plain functions: (state) → Partial<state>.
// Classes don't fit this model well. A base function that takes
// agent-specific callbacks is simpler and more composable.
//
// ## Retry Logic
//
// Each chunk gets up to 2 attempts (1 initial + 1 retry).
// Failed chunks are logged but don't block the pipeline —
// the partial results are still useful.
// ---------------------------------------------------------------------------

import { llmClient } from "@/lib/llm/client";
import type { LLMMessage } from "@/lib/workflow/context";
import type { BookAnalysisStateType } from "@/lib/workflow/state";

// ═══════════════════════════════════════════════════════════════════════════
// Agent Configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentConfig {
  /** Human-readable name for logging */
  name: string;
  /** System prompt that defines the agent's expertise and output format */
  systemPrompt: string;
  /** Builds the user message for a given chunk */
  buildUserMessage: (chunkContent: string, chunkIndex: number, totalChunks: number) => string;
  /** Max retries per chunk (default 2) */
  maxRetries?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Agent Result
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentResult<TItem> {
  chunkIndex: number;
  success: boolean;
  data?: TItem;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Base Agent Runner
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Runs an agent over all chunks in the state.
 *
 * Each chunk is processed independently with retry support.
 * Results are accumulated into an array that the LangGraph
 * append-reducer will merge into the state.
 */
export async function runAgentOverChunks<TItem>(
  state: BookAnalysisStateType,
  config: AgentConfig
): Promise<AgentResult<TItem>[]> {
  const { name, systemPrompt, buildUserMessage, maxRetries = 2 } = config;
  const results: AgentResult<TItem>[] = [];

  console.log(`[Agent:${name}] Processing ${state.chunks.length} chunks...`);

  for (let i = 0; i < state.chunks.length; i++) {
    const chunk = state.chunks[i];
    if (!chunk) continue;

    let success = false;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const messages: LLMMessage[] = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: buildUserMessage(chunk.content, i, state.chunks.length),
          },
        ];

        const data = await llmClient.chatJSON<TItem>(messages, {});

        results.push({ chunkIndex: i, success: true, data });
        success = true;

        console.log(
          `[Agent:${name}] Chunk ${i + 1}/${state.chunks.length} ✓`
        );
        break; // success → move to next chunk
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(
          `[Agent:${name}] Chunk ${i + 1}/${state.chunks.length} attempt ${attempt + 1} failed: ${lastError}`
        );
        // Small delay before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (!success) {
      results.push({ chunkIndex: i, success: false, error: lastError });
      console.warn(
        `[Agent:${name}] Chunk ${i + 1}/${state.chunks.length} ✗ (all ${maxRetries} attempts failed)`
      );
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  console.log(
    `[Agent:${name}] Complete: ${succeeded}/${state.chunks.length} chunks succeeded`
  );

  return results;
}
