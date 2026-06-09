// ---------------------------------------------------------------------------
// Schema: quotes
// ---------------------------------------------------------------------------
import { pgTable, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { books } from "./books";
import { bookAnalysis } from "./analysis";

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => bookAnalysis.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    context: text("context"),
    category: text("category").notNull(), // insight | wisdom | emotional | philosophical | practical
    score: real("score").default(0), // 0.0-1.0 quality score
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    bookIdx: index("idx_quotes_book_id").on(table.bookId),
    analysisIdx: index("idx_quotes_analysis_id").on(table.analysisId),
    // Top quotes by score for a book
    topQuotesIdx: index("idx_quotes_book_score").on(table.bookId, table.score),
    // Filter by category
    categoryIdx: index("idx_quotes_category").on(table.bookId, table.category),
  })
);
