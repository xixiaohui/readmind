// ---------------------------------------------------------------------------
// Schema: books
// ---------------------------------------------------------------------------
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  rawText: text("raw_text").notNull(),
  chunkCount: integer("chunk_count").notNull().default(0),
  status: text("status").notNull().default("uploaded"), // uploaded | processing | completed | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
