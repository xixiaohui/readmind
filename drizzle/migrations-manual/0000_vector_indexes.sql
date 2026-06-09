-- ==========================================================================
-- pgvector Indexes — Manual Migration
-- ==========================================================================
-- Drizzle Kit cannot generate pgvector-specific index types (IVFFlat).
-- These indexes must be created manually AFTER the Drizzle migration runs.
--
-- IVFFlat vs HNSW:
--   IVFFlat: faster build, slightly slower search, good for <1M vectors
--   HNSW:    faster search, slower build, better for >1M vectors
--
-- We use IVFFlat as the default — optimal for book-scale embedding stores.
-- ==========================================================================

-- book_chunks.embedding — for semantic chunk search
-- "lists = 100" is optimal for up to ~100K chunks
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_vector
  ON book_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE (embedding IS NOT NULL);

-- embeddings.embedding — for cross-book semantic search
CREATE INDEX IF NOT EXISTS idx_embeddings_embedding_vector
  ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
