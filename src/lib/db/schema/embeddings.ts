// ---------------------------------------------------------------------------
// Schema: embeddings
// ---------------------------------------------------------------------------
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { books } from "./books";
import { bookChunks } from "./chunks";

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => bookChunks.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    model: text("model").notNull(), // e.g. "text-embedding-3-small"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    bookIdx: index("idx_embeddings_book_id").on(table.bookId),
    chunkIdx: index("idx_embeddings_chunk_id").on(table.chunkId),
  })
);
