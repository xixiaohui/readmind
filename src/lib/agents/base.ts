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
import { z } from "zod/v4";
import type { LLMMessage } from "@/lib/workflow/context";
import type { BookAnalysisStateType } from "@/lib/workflow/state";

// ═══════════════════════════════════════════════════════════════════════════
// Agent Configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentConfig<TItem> {
  /** Human-readable name for logging */
  name: string;
  /** System prompt that defines the agent's expertise and output format */
  systemPrompt: string;
  /** Builds the user message for a given chunk */
  buildUserMessage: (chunkContent: string, chunkIndex: number, totalChunks: number) => string;
  /** Zod schema that validates the LLM's JSON output shape */
  outputSchema: z.ZodType<TItem>;
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
  config: AgentConfig<TItem>
): Promise<AgentResult<TItem>[]> {
  const { name, systemPrompt, buildUserMessage, outputSchema, maxRetries = 2 } = config;
  const results: AgentResult<TItem>[] = [];

  // Detect language from chunks — append instruction so LLM responds in the same language
  const firstChunk = state.chunks[0]?.content ?? "";
  const lang = detectLanguage(firstChunk);
  const langInstruction = lang === "zh"
    ? "\n\nCRITICAL: The text is in Chinese. You MUST respond in Chinese (Simplified). All field values, descriptions, summaries, theme names, and analysis must be in Chinese."
    : lang === "ja"
    ? "\n\nCRITICAL: The text is in Japanese. You MUST respond in Japanese."
    : lang === "en"
    ? "\n\nCRITICAL: The text is in English. You MUST respond in English."
    : "\n\nCRITICAL: Respond in the SAME language as the input text.";
  const localizedPrompt = systemPrompt + langInstruction;

  console.log(`[Agent:${name}] Processing ${state.chunks.length} chunks (${lang})...`);

  for (let i = 0; i < state.chunks.length; i++) {
    const chunk = state.chunks[i];
    if (!chunk) continue;

    let success = false;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const messages: LLMMessage[] = [
          { role: "system", content: localizedPrompt },
          {
            role: "user",
            content: buildUserMessage(chunk.content, i, state.chunks.length),
          },
        ];

        const data = await llmClient.chatJSON<TItem>(messages, outputSchema);

        results.push({ chunkIndex: i, success: true, data });
        success = true;

        console.log(
          `[Agent:${name}] Chunk ${i + 1}/${state.chunks.length} ✓`
        );
        break; // success → move to next chunk
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);

        // Truncate long error messages for log readability
        const shortError = lastError.length > 200
          ? lastError.slice(0, 200) + "..."
          : lastError;

        if (attempt < maxRetries - 1) {
          console.warn(
            `[Agent:${name}] Chunk ${i + 1}/${state.chunks.length} attempt ${attempt + 1} failed (will retry): ${shortError}`
          );
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          console.warn(
            `[Agent:${name}] Chunk ${i + 1}/${state.chunks.length} ✗ (all ${maxRetries} attempts failed): ${shortError}`
          );
        }
      }
    }

    if (!success) {
      results.push({ chunkIndex: i, success: false, error: lastError });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  console.log(
    `[Agent:${name}] Complete: ${succeeded}/${state.chunks.length} chunks succeeded`
  );

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Language Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple heuristic language detection based on character ranges.
 * Sufficient for determining the output language of analysis.
 */
function detectLanguage(text: string): "zh" | "ja" | "en" | "other" {
  let cjk = 0;
  let hiragana = 0;
  let ascii = 0;

  for (const ch of text.slice(0, 2000)) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x3040 && code <= 0x309F) hiragana++;
    else if (code >= 0x4E00 && code <= 0x9FFF) cjk++;
    else if (code >= 0x3400 && code <= 0x4DBF) cjk++;
    else if (code >= 0xF900 && code <= 0xFAFF) cjk++;
    else if (code < 0x80 && code >= 32) ascii++;
  }

  const total = cjk + hiragana + ascii || 1;

  if (hiragana / total > 0.02) return "ja";
  if (cjk / total > 0.15) return "zh";
  if (ascii / total > 0.7) return "en";
  return "other";
}
