// ---------------------------------------------------------------------------
// LLM Client — OpenAI/DeepSeek Implementation
// ---------------------------------------------------------------------------
//
// Implements the LLMClient interface from workflow/context.ts.
// Compatible with both OpenAI and DeepSeek (via baseURL override).
//
// Configuration (from .env.local):
//   OPENAI_API_KEY  — API key for OpenAI or DeepSeek
//   OPENAI_BASE_URL — https://api.deepseek.com/v1 (for DeepSeek)
//   AI_MODEL        — deepseek-chat (default)
//
// ## Why DeepSeek?
//
// DeepSeek offers OpenAI-compatible API at significantly lower cost.
// For a book analysis pipeline that processes 100K+ tokens per book,
// cost is a critical factor. DeepSeek's pricing is ~10x cheaper than
// GPT-4 for comparable quality on structured analysis tasks.
//
// The OpenAI SDK works transparently with DeepSeek — just change
// baseURL and apiKey. No code changes needed.
// ---------------------------------------------------------------------------

import OpenAI from "openai";
import { z } from "zod/v4";
import type { LLMClient, LLMMessage } from "@/lib/workflow/context";

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "sk-placeholder",
  baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
});

const DEFAULT_MODEL = process.env.AI_MODEL ?? "deepseek-chat";
const EMBEDDING_MODEL = "text-embedding-3-small"; // OpenAI embedding model

// ═══════════════════════════════════════════════════════════════════════════
// LLM Client Implementation
// ═══════════════════════════════════════════════════════════════════════════

export const llmClient: LLMClient = {
  // ── Chat Completion ─────────────────────────────────────────────────────

  async chat(messages: LLMMessage[]): Promise<string> {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.3, // lower = more consistent for analysis
      max_tokens: 8192,
      // @ts-expect-error — DeepSeek-specific param, not in OpenAI SDK types
      extra_body: { thinking: { type: "disabled" } },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM returned empty response");
    }
    return content;
  },

  // ── Structured JSON Output ──────────────────────────────────────────────

  async chatJSON<T>(
    messages: LLMMessage[],
    schema: z.ZodType<T>
  ): Promise<T> {
    // Add JSON instruction to system message
    const systemMsg = messages.find((m) => m.role === "system");
    const jsonInstruction =
      "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations. The response must parse with JSON.parse().";

    const augmentedMessages = systemMsg
      ? messages.map((m) =>
          m.role === "system" ? { ...m, content: m.content + jsonInstruction } : m
        )
      : [
          { role: "system" as const, content: jsonInstruction.trim() },
          ...messages,
        ];

    const doCall = async (retryHint?: string): Promise<T> => {
      const msgs = retryHint
        ? [
            ...augmentedMessages.map((m) => ({
              role: m.role as "system" | "user" | "assistant",
              content: m.content,
            })),
            { role: "user" as const, content: retryHint },
          ]
        : augmentedMessages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          }));

      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: msgs,
        temperature: retryHint ? 0 : 0.1,
        max_tokens: 16384,
        response_format: retryHint ? undefined : { type: "json_object" },
        // @ts-expect-error — DeepSeek-specific param, not in OpenAI SDK types
        extra_body: { thinking: { type: "disabled" } },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("LLM returned empty JSON response");
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        if (!retryHint) {
          throw new Error(
            "LLM returned invalid JSON (not parseable). " +
            "First 200 chars: " + content.slice(0, 200)
          );
        }
        throw new Error(
          "LLM retry also returned invalid JSON. " +
          "First 200 chars: " + content.slice(0, 200)
        );
      }

      // Validate shape with Zod — catches prompt/type mismatches early
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("\n");

        if (!retryHint) {
          // Retry once with the schema issues as feedback
          console.warn("[LLM] JSON shape mismatch, retrying with schema feedback");
          return doCall(
            "Your response did not match the required format:\n" +
            issues +
            "\n\nPlease fix your JSON and try again. Output ONLY the corrected JSON."
          );
        }

        throw new Error(
          "LLM JSON shape mismatch after retry:\n" + issues
        );
      }

      return result.data;
    };

    return doCall();
  },

  // ── Embeddings ──────────────────────────────────────────────────────────

  async embed(texts: string[]): Promise<number[][]> {
    // Process in batches of 100 (API limit)
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });

      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  },
};
