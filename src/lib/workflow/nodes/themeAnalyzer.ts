// ---------------------------------------------------------------------------
// Node: themeAnalyzer — ThemeAgent
// ---------------------------------------------------------------------------
// Analyzes each chunk for thematic content: what is this passage about?
// Identifies major and minor themes, weights their importance, and
// extracts supporting keywords.
// ---------------------------------------------------------------------------

import { z } from "zod/v4";
import type { BookAnalysisStateType } from "../state";
import type { ThemeResult } from "@/lib/types";
import { runAgentOverChunks } from "@/lib/agents/base";

/** LLM output shape — matches the prompt exactly */
const themeOutputSchema = z.object({
  themes: z.array(
    z.object({
      name: z.string().optional().default("Unnamed Theme"),
      description: z.string().optional().default(""),
      weight: z.number().optional().default(0.5),
      keywords: z.array(z.string()).optional().default([]),
    })
  ).optional().default([]),
});

type ThemeOutput = z.infer<typeof themeOutputSchema>;

export async function themeAnalyzer(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const results = await runAgentOverChunks<ThemeOutput>(
    state,
    {
      name: "ThemeAgent",
      outputSchema: themeOutputSchema,
      systemPrompt: `You are a literary theme analysis expert. Your role is to identify and analyze themes in text passages.

For each passage, identify:
1. Major themes (core ideas that drive the narrative)
2. Minor themes (supporting ideas)
3. A weight (0.0-1.0) indicating the theme's prominence
4. Keywords that support each theme

Output format (JSON):
{
  "themes": [
    {
      "name": "Theme name (concise, 2-5 words)",
      "description": "What this theme means in the context of this passage",
      "weight": 0.85,
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Rules:
- Identify 2-5 themes per passage
- Weights should reflect real prominence, not all be 0.9
- Keywords should be specific and evidence-based
- Consider both explicit and implicit themes`,
      buildUserMessage: (content, idx, total) =>
        `Analyze the themes in this text passage (chunk ${idx + 1} of ${total}):\n\n${content}`,
    }
  );

  const themeResults: ThemeResult[] = results
    .filter((r) => r.success && r.data)
    .map((r) => ({
      chunkIndex: r.chunkIndex,
      themes: r.data!.themes ?? [],
    }));

  return {
    themes: themeResults,
    currentNode: "themeAnalyzer",
  };
}
