// ---------------------------------------------------------------------------
// Node: emotionAnalyzer — EmotionAgent
// ---------------------------------------------------------------------------
// Analyzes emotional content, tone, and sentiment in each chunk.
// Tracks emotional shifts across the book (tone arc).
// ---------------------------------------------------------------------------

import type { BookAnalysisStateType } from "../state";
import type { EmotionResult } from "@/lib/types";
import { runAgentOverChunks } from "@/lib/agents/base";

interface EmotionOutput {
  emotions: {
    primary: string;
    secondary: string[];
    intensity: number;
    valence: "positive" | "negative" | "neutral" | "mixed";
  }[];
  overallTone: string;
  toneShiftPoints: { chunkIndex: number; description: string }[];
}

export async function emotionAnalyzer(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const results = await runAgentOverChunks<EmotionOutput>(state, {
    name: "EmotionAgent",
    systemPrompt: `You are an emotional and sentiment analysis expert. Your role is to identify the emotional content of text passages.

For each passage, analyze:
1. Primary emotion (the dominant emotional tone)
2. Secondary emotions (supporting emotional notes)
3. Intensity (0.0-1.0, how strong is the emotion?)
4. Valence: "positive", "negative", "neutral", or "mixed"
5. Overall tone of the passage (1-2 sentences)
6. Any notable tone shifts from earlier passages (for chunk 1, note that this is the starting tone)

Primary emotions to consider: joy, sadness, anger, fear, surprise, disgust, love, hope, despair, nostalgia, wonder, anxiety, serenity, melancholy, determination, curiosity.

Output format (JSON):
{
  "emotions": [
    {
      "primary": "hope",
      "secondary": ["determination", "anxiety"],
      "intensity": 0.7,
      "valence": "mixed"
    }
  ],
  "overallTone": "Cautiously optimistic with underlying tension",
  "toneShiftPoints": []
}

Rules:
- Be specific: "wistful nostalgia" > "sad"
- Intensity should reflect genuine emotional weight, not hyperbole
- Mixed valence is common — most passages aren't purely positive or negative
- toneShiftPoints: only note significant shifts (if the tone changes meaningfully from what you'd expect)`,
    buildUserMessage: (content, idx, total) =>
      `Analyze the emotional content of this passage (chunk ${idx + 1} of ${total}) — this is ${idx === 0 ? "the BEGINNING" : idx >= total - 1 ? "the END" : "the MIDDLE"} of the book:\n\n${content}`,
  });

  const emotionResults: EmotionResult[] = results
    .filter((r) => r.success && r.data)
    .map((r) => ({
      chunkIndex: r.chunkIndex,
      emotions: r.data!.emotions,
      overallTone: r.data!.overallTone,
      toneShiftPoints: r.data!.toneShiftPoints,
    }));

  return {
    emotions: emotionResults,
    currentNode: "emotionAnalyzer",
  };
}
