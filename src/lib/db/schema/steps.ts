// ---------------------------------------------------------------------------
// Schema: workflow_steps
// ---------------------------------------------------------------------------
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { workflowRuns } from "./workflows";

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    nodeName: text("node_name").notNull(),
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    inputData: jsonb("input_data"),
    outputData: jsonb("output_data"),
    error: text("error"),
    retryCount: integer("retry_count").notNull().default(0),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Fast lookup: "all steps for a given workflow"
    workflowIdx: index("idx_workflow_steps_workflow_id").on(table.workflowId),
    // Ordered steps within a workflow
    workflowOrderIdx: index("idx_workflow_steps_wf_order").on(
      table.workflowId,
      table.createdAt
    ),
  })
);
