// ---------------------------------------------------------------------------
// Aggregator — Map-Reduce REDUCE Phase
// ---------------------------------------------------------------------------
//
// This is where the magic happens. After 5 agents independently process
// 100 chunks (MAP phase), we have:
//   - 100 ThemeResult[]     (potentially 300+ individual themes)
//   - 100 SummaryResult[]   (100 independent summaries)
//   - 100 QuoteResult[]     (potentially 200+ quotes)
//   - 100 PhilosophyResult[] (100 framework analyses)
//   - 100 EmotionResult[]   (100 emotional snapshots)
//
// The REDUCE phase transforms these into ONE coherent analysis:
//   - 5-10 major themes (deduplicated, ranked, described)
//   - 1 full-book summary (synthesized from chunk summaries)
//   - Top 20 quotes (ranked by quality, diversified by category)
//   - 1 unified philosophy framework
//   - 1 emotional arc across the entire book
//
// ## Design: Algorithmic + LLM Hybrid
//
// Algorithmic approaches are used where precision matters:
//   - Quote ranking: pure math (score-based, deterministic)
//   - Emotion arc: pure math (aggregate per-chunk data)
//   - Theme deduplication: algorithmic grouping + LLM merge description
//
// LLM is used where synthesis is needed:
//   - Full-book summary: requires understanding narrative across chunks
//   - Theme synthesis: requires merging descriptions coherently
//   - Philosophy merge: requires finding common threads
//
// This hybrid approach minimizes cost while maximizing quality.
// ---------------------------------------------------------------------------

import { llmClient } from "@/lib/llm/client";
import { z } from "zod/v4";
import type { LLMMessage } from "@/lib/workflow/context";
import type {
  ThemeResult,
  SummaryResult,
  QuoteResult,
  PhilosophyResult,
  EmotionResult,
  AggregatedAnalysis,
} from "@/lib/types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Theme Aggregation — Deduplicate + Synthesize
// ═══════════════════════════════════════════════════════════════════════════

interface MergedTheme {
  name: string;
  description: string;
  weight: number;
  occurrences: number;
  keywords: string[];
  chunkIndices: number[];
}

/**
 * Aggregates per-chunk themes into a deduplicated, ranked list.
 *
 * Step 1: Flatten all themes from all chunks
 * Step 2: Group similar themes using name similarity (Jaccard on keywords)
 * Step 3: For each group with >1 member, use LLM to synthesize a merged description
 * Step 4: Rank by (weight × occurrences)
 */
export async function aggregateThemes(
  themeResults: ThemeResult[]
): Promise<AggregatedAnalysis["themes"]> {
  if (themeResults.length === 0) return [];

  // Step 1: Flatten
  const flatThemes = themeResults.flatMap((tr) =>
    tr.themes.map((t) => ({
      ...t,
      chunkIndex: tr.chunkIndex,
    }))
  );

  // Step 2: Group by name similarity (simple keyword overlap)
  const groups = groupSimilarThemes(flatThemes);

  // Step 3: Merge each group
  const merged: MergedTheme[] = [];
  for (const group of groups) {
    if (group.length === 1) {
      const t = group[0]!;
      merged.push({
        name: t.name,
        description: t.description,
        weight: t.weight,
        occurrences: 1,
        keywords: t.keywords,
        chunkIndices: [t.chunkIndex],
      });
    } else {
      // Multiple similar themes — use LLM to synthesize description
      const synthesized = await synthesizeThemeGroup(group);
      merged.push(synthesized);
    }
  }

  // Step 4: Rank by weight × occurrences, take top 15
  const sorted = merged
    .sort((a, b) => b.weight * b.occurrences - a.weight * a.occurrences)
    .slice(0, 15)
    .map((t) => ({
      name: t.name,
      description: t.description,
      weight: t.weight,
      occurrences: t.occurrences,
    }));

  return sorted;
}

/**
 * Groups similar themes by keyword overlap (Jaccard similarity).
 * Two themes are "similar" if they share ≥40% of their keywords.
 */
function groupSimilarThemes(
  themes: (ThemeResult["themes"][number] & { chunkIndex: number })[]
): (typeof themes)[] {
  const groups: (typeof themes)[] = [];
  const used = new Set<number>();

  for (let i = 0; i < themes.length; i++) {
    if (used.has(i)) continue;

    const group = [themes[i]!];
    used.add(i);

    for (let j = i + 1; j < themes.length; j++) {
      if (used.has(j)) continue;

      const similarity = jaccardSimilarity(
        themes[i]!.keywords,
        themes[j]!.keywords
      );
      if (similarity >= 0.4) {
        group.push(themes[j]!);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((k) => k.toLowerCase()));
  const setB = new Set(b.map((k) => k.toLowerCase()));
  const intersection = new Set([...setA].filter((k) => setB.has(k)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

async function synthesizeThemeGroup(
  group: (ThemeResult["themes"][number] & { chunkIndex: number })[]
): Promise<MergedTheme> {
  const primaryName = group[0]!.name;
  const variants = group.map((t) => `"${t.name}": ${t.description}`).join("\n");
  const langNote = detectLangNote(primaryName);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are a theme synthesis expert. Multiple chunks of a book identified similar themes.
Merge them into ONE coherent theme definition.

Output format (JSON):
{
  "name": "Concise theme name",
  "description": "Synthesized description combining all variants",
  "mergedKeywords": ["keyword1", "keyword2", "..."]
}

Rules:
- The name should be the best representation of this theme cluster
- The description should capture what ALL variants share
- mergedKeywords should include the most important keywords from all variants
${langNote}`,
    },
    {
      role: "user",
      content: `Synthesize these theme variants into one definition.\nPrimary name: "${primaryName}"\n\nVariants:\n${variants}`,
    },
  ];

  const themeMergeSchema = z.object({
    name: z.string(),
    description: z.string(),
    mergedKeywords: z.array(z.string()),
  });

  try {
    const result = await llmClient.chatJSON(messages, themeMergeSchema);

    return {
      name: result.name,
      description: result.description,
      weight: average(group.map((t) => t.weight)),
      occurrences: group.length,
      keywords: result.mergedKeywords,
      chunkIndices: group.map((t) => t.chunkIndex),
    };
  } catch {
    // Fallback: use the most common name
    return {
      name: primaryName,
      description: group.map((t) => t.description).join(" "),
      weight: average(group.map((t) => t.weight)),
      occurrences: group.length,
      keywords: group[0]?.keywords ?? [],
      chunkIndices: group.map((t) => t.chunkIndex),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Summary Synthesis — Compress 100 Summaries → 1
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Synthesizes per-chunk summaries into a full-book summary.
 *
 * This is the classic Map-Reduce summarization pattern:
 *   MAP:   Each chunk → independent summary
 *   REDUCE: All summaries → LLM synthesis → one coherent summary
 *
 * If there are many chunks (>15), we do a two-stage reduce:
 *   Stage 1: Group 15 summaries → intermediate summary
 *   Stage 2: Combine intermediates → final summary
 */
export async function synthesizeSummary(
  summaryResults: SummaryResult[],
  bookTitle: string
): Promise<string> {
  if (summaryResults.length === 0) return "";

  const summaries = summaryResults.map((sr) => sr.summary);

  // For ≤15 chunks: direct synthesis
  if (summaries.length <= 15) {
    return synthesizeFromSummaries(summaries, bookTitle);
  }

  // For >15 chunks: two-stage reduce
  const intermediates: string[] = [];
  for (let i = 0; i < summaries.length; i += 15) {
    const batch = summaries.slice(i, i + 15);
    const intermediate = await synthesizeFromSummaries(batch, bookTitle);
    intermediates.push(intermediate);
  }

  // Stage 2: synthesize intermediates
  return synthesizeFromSummaries(intermediates, bookTitle);
}

async function synthesizeFromSummaries(
  summaries: string[],
  bookTitle: string
): Promise<string> {
  const sampleText = summaries[0] ?? bookTitle;
  const langNote = detectLangNote(sampleText);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are a book summary expert. Synthesize multiple chapter/section summaries
into ONE coherent, flowing summary of the entire book.

Your summary should:
- Be 150-300 words of dense, informative prose
- Capture the book's main argument, key ideas, and narrative arc
- Flow naturally as a single narrative (not a list)
- Be immediately understandable to someone who hasn't read the summaries

Do not mention "the summaries" or "the analysis" —
write as if you're summarizing the book itself.
${langNote}`,
    },
    {
      role: "user",
      content: `Synthesize these summaries of "${bookTitle}" into one coherent summary:\n\n${summaries.join("\n\n---\n\n")}`,
    },
  ];

  try {
    return await llmClient.chat(messages);
  } catch {
    // Fallback: concatenate with separators
    return `Summary of "${bookTitle}":\n\n${summaries.join("\n\n")}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Quote Ranking — Score + Diversity
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ranks and selects the best quotes across all chunks.
 *
 * Algorithm:
 *   1. Flatten all quotes from all chunks
 *   2. Sort by score (descending)
 *   3. Ensure category diversity (max 30% from any single category)
 *   4. Return top 20
 */
export function rankQuotes(
  quoteResults: QuoteResult[]
): AggregatedAnalysis["topQuotes"] {
  const allQuotes = quoteResults.flatMap((qr) => qr.quotes);

  if (allQuotes.length === 0) return [];

  // Sort by score
  const sorted = [...allQuotes].sort((a, b) => b.score - a.score);

  // Diversity: cap each category at 30% of total
  const maxPerCategory = Math.ceil(20 * 0.3); // = 6
  const categoryCounts: Record<string, number> = {};
  const selected: typeof allQuotes = [];

  for (const quote of sorted) {
    const count = categoryCounts[quote.category] ?? 0;
    if (count >= maxPerCategory) continue;

    selected.push(quote);
    categoryCounts[quote.category] = count + 1;

    if (selected.length >= 20) break;
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Philosophy Aggregation
// ═══════════════════════════════════════════════════════════════════════════

export async function aggregatePhilosophy(
  philosophyResults: PhilosophyResult[]
): Promise<AggregatedAnalysis["philosophy"]> {
  const allFrameworks = philosophyResults.flatMap((pr) => pr.frameworks);

  if (allFrameworks.length === 0) {
    return { primaryFrameworks: [], argumentSummary: "" };
  }

  // Group frameworks by name
  const frameworkMap = new Map<
    string,
    { confidences: number[]; descriptions: string[] }
  >();

  for (const fw of allFrameworks) {
    const key = fw.name.toLowerCase();
    const existing = frameworkMap.get(key);
    if (existing) {
      existing.confidences.push(fw.confidence);
      existing.descriptions.push(fw.description);
    } else {
      frameworkMap.set(key, {
        confidences: [fw.confidence],
        descriptions: [fw.description],
      });
    }
  }

  // Build ranked framework list
  const primaryFrameworks = Array.from(frameworkMap.entries())
    .map(([name, data]) => ({
      name,
      description: data.descriptions.join(" "),
      confidence: average(data.confidences) * Math.min(1, data.descriptions.length / 3),
      relatedThemes: [] as string[],
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  // Synthesize argument summary
  const allArguments = philosophyResults.flatMap((pr) =>
    pr.argumentStructure.map((a) => a.claim)
  );
  const argumentSummary =
    allArguments.length > 0
      ? `The book advances ${allArguments.length} key arguments across ${philosophyResults.length} sections. Major claims include: ${allArguments.slice(0, 5).join("; ")}${allArguments.length > 5 ? `, and ${allArguments.length - 5} more.` : "."}`
      : "";

  return { primaryFrameworks, argumentSummary };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Emotion Arc — From Snapshots to Trajectory
// ═══════════════════════════════════════════════════════════════════════════

export function buildEmotionArc(
  emotionResults: EmotionResult[]
): AggregatedAnalysis["emotions"] {
  if (emotionResults.length === 0) {
    return {
      overallTone: "Unknown",
      emotionArc: [],
      valenceDistribution: {},
    };
  }

  // Overall tone: most common overallTone
  const toneCounts: Record<string, number> = {};
  for (const er of emotionResults) {
    const tone = er.overallTone;
    toneCounts[tone] = (toneCounts[tone] ?? 0) + 1;
  }
  const overallTone = Object.entries(toneCounts).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] ?? "Neutral";

  // Emotion arc: average intensity per chunk position
  const arc: { label: string; intensity: number }[] = [];
  const segmentSize = Math.max(1, Math.floor(emotionResults.length / 10));

  for (let i = 0; i < emotionResults.length; i += segmentSize) {
    const segment = emotionResults.slice(i, i + segmentSize);
    const avgIntensity = average(
      segment.flatMap((er) => er.emotions.map((e) => e.intensity))
    );
    const primaryEmotions = segment.flatMap((er) =>
      er.emotions.map((e) => e.primary)
    );
    const mostCommon = mode(primaryEmotions) ?? "neutral";

    arc.push({
      label: `Ch.${i + 1}-${Math.min(i + segmentSize, emotionResults.length)}: ${mostCommon}`,
      intensity: avgIntensity,
    });
  }

  // Valence distribution
  const valenceDist: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  const allValences = emotionResults.flatMap((er) =>
    er.emotions.map((e) => e.valence)
  );
  for (const v of allValences) {
    valenceDist[v] = (valenceDist[v] ?? 0) + 1;
  }
  // Normalize
  const total = allValences.length || 1;
  for (const key of Object.keys(valenceDist)) {
    valenceDist[key] = Math.round((valenceDist[key]! / total) * 100) / 100;
  }

  return { overallTone, emotionArc: arc, valenceDistribution: valenceDist };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Master Aggregator
// ═══════════════════════════════════════════════════════════════════════════

export interface AggregationInput {
  bookId: string;
  workflowId: string;
  title: string;
  themeResults: ThemeResult[];
  summaryResults: SummaryResult[];
  quoteResults: QuoteResult[];
  philosophyResults: PhilosophyResult[];
  emotionResults: EmotionResult[];
  chunkCount: number;
  totalTokens: number;
  processingStartTime: number;
  model: string;
}

export async function aggregateAll(
  input: AggregationInput
): Promise<AggregatedAnalysis> {
  const processingTimeMs = Date.now() - input.processingStartTime;

  // Run each aggregator independently — one failure doesn't block the others.
  // Promise.allSettled ensures partial results are preserved.
  const [themeRes, summaryRes, quoteRes, philoRes, emotionRes] =
    await Promise.allSettled([
      aggregateThemes(input.themeResults ?? []),
      synthesizeSummary(input.summaryResults ?? [], input.title),
      Promise.resolve(rankQuotes(input.quoteResults ?? [])),
      aggregatePhilosophy(input.philosophyResults ?? []),
      Promise.resolve(buildEmotionArc(input.emotionResults ?? [])),
    ]);

  const themes = themeRes.status === "fulfilled" ? themeRes.value : [] as AggregatedAnalysis["themes"];
  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : `Summary of "${input.title}" is unavailable.`;
  const topQuotes = quoteRes.status === "fulfilled" ? quoteRes.value : [] as AggregatedAnalysis["topQuotes"];
  const philosophy = philoRes.status === "fulfilled" ? philoRes.value : { primaryFrameworks: [], argumentSummary: "" } as AggregatedAnalysis["philosophy"];
  const emotions = emotionRes.status === "fulfilled" ? emotionRes.value : { overallTone: "Unknown", emotionArc: [], valenceDistribution: {} } as AggregatedAnalysis["emotions"];

  // Log any aggregation failures
  if (themeRes.status === "rejected") console.warn("[aggregateAll] Themes aggregation failed:", themeRes.reason);
  if (summaryRes.status === "rejected") console.warn("[aggregateAll] Summary aggregation failed:", summaryRes.reason);
  if (philoRes.status === "rejected") console.warn("[aggregateAll] Philosophy aggregation failed:", philoRes.reason);

  return {
    bookId: input.bookId,
    workflowId: input.workflowId,
    title: input.title,
    themes,
    summary,
    topQuotes,
    philosophy,
    emotions,
    metadata: {
      chunkCount: input.chunkCount ?? 0,
      totalTokens: input.totalTokens ?? 0,
      processingTimeMs,
      model: input.model ?? "unknown",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Detects the language of a short text sample and returns an instruction
 * for the LLM to respond in that language.
 */
function detectLangNote(text: string): string {
  let cjk = 0, ascii = 0;
  for (const ch of text.slice(0, 500)) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x4E00 && code <= 0x9FFF) cjk++;
    else if (code >= 0x3400 && code <= 0x4DBF) cjk++;
    else if (code < 0x80 && code >= 32) ascii++;
  }
  const total = cjk + ascii || 1;
  const cjkRatio = cjk / total;

  if (cjkRatio > 0.1) {
    return "\nIMPORTANT: The text is Chinese. You MUST respond in Chinese (Simplified).";
  }
  if (ascii / total > 0.7) {
    return "\nIMPORTANT: The text is English. You MUST respond in English.";
  }
  return "\nIMPORTANT: Respond in the same language as the input text.";
}

function mode<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxItem: T | undefined;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }
  return maxItem;
}
