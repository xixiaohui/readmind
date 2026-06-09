// ---------------------------------------------------------------------------
// Schema: book_analysis
// ---------------------------------------------------------------------------
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { books } from "./books";
import { workflowRuns } from "./workflows";

export const bookAnalysis = pgTable(
  "book_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(), // theme | summary | quote | philosophy | emotion
    chunkIndex: integer("chunk_index"), // NULL = aggregated (final) result
    result: jsonb("result").notNull(), // JSON output from the agent
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Get all analysis for a book
    bookIdx: index("idx_book_analysis_book_id").on(table.bookId),
    // Get analysis from a specific workflow run
    workflowIdx: index("idx_book_analysis_workflow_id").on(table.workflowId),
    // Filter by analysis type (e.g., "get all theme analyses")
    typeIdx: index("idx_book_analysis_type").on(table.analysisType),
    // Get aggregated results only (chunk_index IS NULL)
    aggregatedIdx: index("idx_book_analysis_aggregated").on(
      table.bookId,
      table.analysisType
    ).where(sql`chunk_index IS NULL`),
  })
);
