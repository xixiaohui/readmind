// ---------------------------------------------------------------------------
// Schema: themes
// ---------------------------------------------------------------------------
import {
  pgTable,
  uuid,
  text,
  real,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { books } from "./books";
import { bookAnalysis } from "./analysis";

export const themes = pgTable(
  "themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => bookAnalysis.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    weight: real("weight").default(0), // 0.0-1.0 importance
    evidence: jsonb("evidence"), // supporting chunks/quotes
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    bookIdx: index("idx_themes_book_id").on(table.bookId),
    analysisIdx: index("idx_themes_analysis_id").on(table.analysisId),
    // Top themes by weight for a book
    topThemesIdx: index("idx_themes_book_weight").on(table.bookId, table.weight),
  })
);
