// ---------------------------------------------------------------------------
// Node: embeddingChunks — Vector Embedding Generation
// ---------------------------------------------------------------------------
// Generates vector embeddings for every chunk using OpenAI/DeepSeek API.
//
// This is a critical node because:
//   1. Embeddings enable semantic search (RAG, "find similar passages")
//   2. They're stored in pgvector for efficient vector search
//   3. Each chunk gets a 1536-dimensional vector
//
// After this node:
//   - The parallel fan-out to 5 agent nodes begins
//   - Each agent processes all chunks independently
//
// ## Batch Processing
//
// OpenAI's embedding API supports up to 100 texts per request.
// We batch chunks in groups of 100 to minimize API calls.
//
// ## Cost Estimation
//
// For a 500-page book (~250K words, ~2000 tokens per chunk, ~150 chunks):
//   150 chunks × 1536 dimensions = 230,400 vector values
//   At $0.02/1M tokens (DeepSeek) or $0.02/1M tokens (text-embedding-3-small):
//   ≈ $0.0003 per book (negligible)
// ---------------------------------------------------------------------------

import { llmClient } from "@/lib/llm/client";
import { db } from "@/lib/db/connection";
import { embeddings } from "@/lib/db/schema";
import type { BookAnalysisStateType } from "../state";

export async function embeddingChunks(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const { chunks, bookId } = state;

  if (chunks.length === 0) {
    console.warn("[embeddingChunks] No chunks to embed. Was splitBook run?");
    return { currentNode: "embeddingChunks" };
  }

  // Extract text content from each chunk
  const texts = chunks.map((c) => c.content);

  // Generate embeddings in batches.
  // Gracefully skip if the provider doesn't support embeddings (e.g. DeepSeek).
  let vectors: number[][] = [];
  try {
    vectors = await llmClient.embed(texts);
  } catch (err) {
    const isUnsupported =
      err instanceof Error &&
      (err.message.includes("404") ||
       err.message.includes("not found") ||
       err.message.includes("not supported"));
    if (isUnsupported) {
      console.warn(
        "[embeddingChunks] Embedding API not available — skipping vector generation. " +
        "Semantic search will be unavailable."
      );
    } else {
      throw err; // re-throw non-404 errors
    }
  }

  // Attach embeddings to chunks (in-memory) if we got them
  const chunksWithEmbeddings =
    vectors.length > 0
      ? chunks.map((chunk, i) => ({
          ...chunk,
          embedding: vectors[i],
        }))
      : chunks;

  // Persist embeddings to PostgreSQL
  if (vectors.length > 0) {
    const validRows = chunksWithEmbeddings
      .map((_chunk, i) => {
        const chunkId = (state.chunks[i] as { id?: string } | undefined)?.id;
        if (!chunkId) return null;
        return {
          bookId,
          chunkId,
          embedding: vectors[i]!,
          model: "text-embedding-3-small",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (validRows.length > 0) {
      await db.insert(embeddings).values(validRows);
    }
  }

  return {
    chunks: chunksWithEmbeddings,
    embeddings: vectors,
    currentNode: "embeddingChunks",
  };
}
