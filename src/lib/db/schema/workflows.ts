// ---------------------------------------------------------------------------
// Schema: workflow_runs
// ---------------------------------------------------------------------------
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { books } from "./books";

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    currentNode: text("current_node"),
    currentChunkIndex: integer("current_chunk_index").default(0),
    progress: real("progress").default(0), // 0.0 to 1.0
    stateSnapshot: jsonb("state_snapshot"), // full LangGraph state for checkpoint/recovery
    checkpointId: text("checkpoint_id"),
    retryCount: integer("retry_count").notNull().default(0),
    errors: jsonb("errors"), // WorkflowError[]
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Fast lookup: "what workflows are running for this book?"
    bookIdx: index("idx_workflow_runs_book_id").on(table.bookId),
    // User's workflow history (mobile: "my analyses")
    userIdx: index("idx_workflow_runs_user_id").on(table.userId),
    // Filter by status (e.g., find all running workflows)
    statusIdx: index("idx_workflow_runs_status").on(table.status),
    // Active workflows sorted by creation time
    activeWorkflowsIdx: index("idx_workflow_runs_active").on(
      table.status,
      table.createdAt
    ),
  })
);
