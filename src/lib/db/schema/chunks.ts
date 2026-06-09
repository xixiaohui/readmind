// ---------------------------------------------------------------------------
// Schema: book_chunks
// ---------------------------------------------------------------------------
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { books } from "./books";

export const bookChunks = pgTable(
  "book_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Each (bookId, chunkIndex) pair must be unique
    bookChunkUnique: uniqueIndex("uq_book_chunks_book_chunk").on(
      table.bookId,
      table.chunkIndex
    ),
    // Fast lookup by book
    bookIdx: index("idx_book_chunks_book_id").on(table.bookId),
    // Ordered chunk access for sequential processing
    chunkOrderIdx: index("idx_book_chunks_book_order").on(
      table.bookId,
      table.chunkIndex
    ),
  })
);
