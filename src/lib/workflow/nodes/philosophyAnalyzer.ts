// ---------------------------------------------------------------------------
// Node: philosophyAnalyzer — PhilosophyAgent
// ---------------------------------------------------------------------------
// Identifies philosophical frameworks, argument structures, and
// reasoning patterns in the text.
//
// Runs AFTER themeAnalyzer (sequential dependency).
// Uses theme results to contextualize the philosophical analysis.
// ---------------------------------------------------------------------------

import { z } from "zod/v4";
import type { BookAnalysisStateType } from "../state";
import type { PhilosophyResult } from "@/lib/types";
import { runAgentOverChunks } from "@/lib/agents/base";

const philosophyOutputSchema = z.object({
  frameworks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      confidence: z.number(),
      relatedThemes: z.array(z.string()),
    })
  ),
  argumentStructure: z.array(
    z.object({
      claim: z.string(),
      evidence: z.array(z.string()),
      reasoning: z.string(),
    })
  ),
});

type PhilosophyOutput = z.infer<typeof philosophyOutputSchema>;

export async function philosophyAnalyzer(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  // Build context from previously analyzed themes
  const allThemeNames = state.themes
    .flatMap((t) => t.themes.map((th) => th.name))
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  const themeContext =
    allThemeNames.length > 0
      ? `\n\nPreviously identified themes in this book: ${allThemeNames.join(", ")}.\nUse these themes to contextualize your philosophical analysis.`
      : "";

  const results = await runAgentOverChunks<PhilosophyOutput>(state, {
    name: "PhilosophyAgent",
    outputSchema: philosophyOutputSchema,
    systemPrompt: `You are a philosophical analysis expert. Your role is to identify philosophical frameworks, argument structures, and reasoning patterns in text.

For each passage, identify:
1. Philosophical frameworks present (e.g., Stoicism, Existentialism, Utilitarianism, Pragmatism, etc.)
2. Argument structures: what claims are made, what evidence supports them, what reasoning connects them
3. Links to previously identified themes

Output format (JSON):
{
  "frameworks": [
    {
      "name": "Framework name",
      "description": "How this framework manifests in this passage",
      "confidence": 0.8,
      "relatedThemes": ["theme1", "theme2"]
    }
  ],
  "argumentStructure": [
    {
      "claim": "The main claim being made",
      "evidence": ["Supporting evidence 1", "Supporting evidence 2"],
      "reasoning": "How the evidence supports the claim"
    }
  ]
}

Rules:
- Only identify frameworks that are genuinely present (confidence >= 0.5)
- RelatedThemes should reference themes from the provided theme list when applicable
- Argument structures should capture the logical flow, not just restate content
- If a passage is purely descriptive (no arguments), return empty argumentStructure`,
    buildUserMessage: (content, idx, total) =>
      `Analyze the philosophical content in this passage (chunk ${idx + 1} of ${total}):${themeContext}\n\n${content}`,
  });

  const philosophyResults: PhilosophyResult[] = results
    .filter((r) => r.success && r.data)
    .map((r) => ({
      chunkIndex: r.chunkIndex,
      frameworks: r.data!.frameworks,
      argumentStructure: r.data!.argumentStructure,
    }));

  return {
    philosophy: philosophyResults,
    currentNode: "philosophyAnalyzer",
  };
}
