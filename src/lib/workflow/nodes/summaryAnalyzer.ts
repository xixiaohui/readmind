// ---------------------------------------------------------------------------
// Node: summaryAnalyzer — SummaryAgent
// ---------------------------------------------------------------------------
// Generates structured summaries for each chunk.
// Outputs: a concise summary, key points, and reading difficulty level.
// ---------------------------------------------------------------------------

import { z } from "zod/v4";
import type { BookAnalysisStateType } from "../state";
import type { SummaryResult } from "@/lib/types";
import { runAgentOverChunks } from "@/lib/agents/base";

const summaryOutputSchema = z.object({
  summary: z.string().optional().default("No summary available for this passage."),
  keyPoints: z.array(z.string()).optional().default([]),
  readingLevel: z.enum(["beginner", "intermediate", "advanced"]).optional().default("intermediate"),
});

type SummaryOutput = z.infer<typeof summaryOutputSchema>;

export async function summaryAnalyzer(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const results = await runAgentOverChunks<SummaryOutput>(state, {
    name: "SummaryAgent",
    outputSchema: summaryOutputSchema,
    systemPrompt: `You are a structured summary expert. Your role is to create clear, accurate summaries of text passages.

For each passage, provide:
1. A concise summary (3-5 sentences capturing the essential content)
2. 3-5 key points (bullet-worthy facts or insights)
3. Reading difficulty level: "beginner", "intermediate", or "advanced"

Output format (JSON):
{
  "summary": "Concise summary text...",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "readingLevel": "intermediate"
}

Rules:
- Summary must be self-contained (understandable without reading the original)
- Key points should be specific, not generic
- Reading level: "beginner" (simple vocabulary, short sentences), "intermediate" (some complexity), "advanced" (academic/dense)
- Be objective — describe what the text says, not your opinion about it`,
    buildUserMessage: (content, idx, total) =>
      `Summarize this text passage (chunk ${idx + 1} of ${total}):\n\n${content}`,
  });

  const summaryResults: SummaryResult[] = results
    .filter((r) => r.success && r.data)
    .map((r) => ({
      chunkIndex: r.chunkIndex,
      summary: r.data!.summary,
      keyPoints: r.data!.keyPoints,
      readingLevel: r.data!.readingLevel,
    }));

  return {
    summaries: summaryResults,
    currentNode: "summaryAnalyzer",
  };
}
