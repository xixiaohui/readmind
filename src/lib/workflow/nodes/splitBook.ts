// ---------------------------------------------------------------------------
// Node: splitBook
// ---------------------------------------------------------------------------
// Splits raw text into manageable chunks for LLM processing.
//
// Uses RecursiveCharacterTextSplitter — the industry standard for RAG/text
// pipelines. It tries to split on natural boundaries:
//   \n\n (paragraphs) → \n (lines) → . (sentences) → " " (words)
//
// Configuration:
//   - chunkSize: 2000 characters (~500 tokens for English text)
//   - chunkOverlap: 200 characters (preserves context across boundaries)
//
// WHY 2000 chars?
//   - DeepSeek context window is 128K tokens, but attention quality
//     degrades with longer inputs
//   - 2000 chars ≈ 500 tokens is in the "sweet spot" for analysis quality
//   - Smaller chunks = more chunks = more parallel opportunities
//
// WHY overlap?
//   - A theme might span chunk boundaries
//   - Overlap ensures no important context is lost at the seams
// ---------------------------------------------------------------------------

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { BookAnalysisStateType } from "../state";
import type { Chunk } from "@/lib/types";

export async function splitBook(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const { rawText } = state;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error("No text to split. Ensure loadBook completed successfully.");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000, // characters per chunk
    chunkOverlap: 200, // overlap between adjacent chunks
    separators: ["\n\n", "\n", "。", ".", "！", "？", " ", ""],
  });

  const documents = await splitter.createDocuments([rawText]);

  const chunks: Chunk[] = documents.map((doc, index) => ({
    index,
    content: doc.pageContent,
    tokenCount: estimateTokenCount(doc.pageContent),
  }));

  return {
    chunks,
    currentNode: "splitBook",
  };
}

/**
 * Quick token count estimation (~4 chars per token for English,
 * ~1.5 chars per token for Chinese).
 * Production implementation would use a proper tokenizer.
 */
function estimateTokenCount(text: string): number {
  // Mixed estimation: count ASCII vs CJK characters
  const asciiChars = (text.match(/[\x00-\x7F]/g) || []).length;
  const cjkChars = text.length - asciiChars;
  return Math.ceil(asciiChars / 4 + cjkChars / 1.5);
}
