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
      max_tokens: 2048,
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
    _schema: Record<string, unknown>
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

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: augmentedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.1, // very low for structured output
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM returned empty JSON response");
    }

    try {
      return JSON.parse(content) as T;
    } catch (parseError) {
      // Retry once without JSON format constraint
      console.warn("[LLM] JSON parse failed, retrying without json_object format");
      const retryResponse = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          ...augmentedMessages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
          {
            role: "user",
            content:
              "Your previous response was not valid JSON. Please try again. Output ONLY the JSON object, no other text.",
          },
        ],
        temperature: 0,
        max_tokens: 4096,
      });

      const retryContent = retryResponse.choices[0]?.message?.content;
      if (!retryContent) {
        throw new Error("LLM retry returned empty response");
      }
      return JSON.parse(retryContent) as T;
    }
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
