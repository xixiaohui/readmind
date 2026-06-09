// ---------------------------------------------------------------------------
// Node: quoteExtractor — QuoteAgent
// ---------------------------------------------------------------------------
// Extracts insightful, memorable, or impactful quotes from each chunk.
// Each quote is categorized and scored for quality.
// ---------------------------------------------------------------------------

import type { BookAnalysisStateType } from "../state";
import type { QuoteResult } from "@/lib/types";
import { runAgentOverChunks } from "@/lib/agents/base";

interface QuoteOutput {
  quotes: {
    text: string;
    context: string;
    category: "insight" | "wisdom" | "emotional" | "philosophical" | "practical";
    score: number;
  }[];
}

export async function quoteExtractor(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const results = await runAgentOverChunks<QuoteOutput>(state, {
    name: "QuoteAgent",
    systemPrompt: `You are a quote curation expert. Your role is to identify and extract the most meaningful, insightful, or powerful quotes from text passages.

For each passage, extract 1-5 quotes that are:
- Insightful (reveals a deep truth)
- Wise (timeless wisdom)
- Emotional (powerfully moving)
- Philosophical (thought-provoking ideas)
- Practical (actionable advice)

For each quote, provide:
1. The exact text (verbatim from the passage)
2. Brief context (1 sentence explaining why this quote matters)
3. Category (one of: insight, wisdom, emotional, philosophical, practical)
4. Quality score (0.0-1.0, how impactful is this quote?)

Output format (JSON):
{
  "quotes": [
    {
      "text": "The exact quote text...",
      "context": "Why this quote is meaningful in the broader context",
      "category": "wisdom",
      "score": 0.9
    }
  ]
}

Rules:
- ONLY extract quotes that are genuinely impactful (score >= 0.6)
- If no good quotes exist in this passage, return empty array — don't force it
- Quotes must be VERBATIM from the text
- Quality over quantity: 1 great quote > 5 mediocre ones`,
    buildUserMessage: (content, idx, total) =>
      `Extract meaningful quotes from this passage (chunk ${idx + 1} of ${total}):\n\n${content}`,
  });

  const quoteResults: QuoteResult[] = results
    .filter((r) => r.success && r.data)
    .map((r) => ({
      chunkIndex: r.chunkIndex,
      quotes: r.data!.quotes,
    }));

  return {
    quotes: quoteResults,
    currentNode: "quoteExtractor",
  };
}
