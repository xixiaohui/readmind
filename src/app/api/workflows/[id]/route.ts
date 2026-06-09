// ---------------------------------------------------------------------------
// GET /api/workflows/[id]
// ---------------------------------------------------------------------------
// Returns the current status and progress of a workflow run.
// This is the polling endpoint for mobile apps to check "is my analysis done?"
//
// Response includes:
//   - Current node and progress (0-1)
//   - Step history with [✓] / [⏳] / [✗] indicators
//   - Error details if failed
// ---------------------------------------------------------------------------

import { loadCheckpoint, getStepHistory } from "@/lib/workflow/checkpoint";
import { db } from "@/lib/db/connection";
import { workflowRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, notFound } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: workflowId } = await params;

  // Get workflow record
  const [workflow] = await db
    .select({
      id: workflowRuns.id,
      bookId: workflowRuns.bookId,
      userId: workflowRuns.userId,
      status: workflowRuns.status,
      currentNode: workflowRuns.currentNode,
      currentChunkIndex: workflowRuns.currentChunkIndex,
      progress: workflowRuns.progress,
      retryCount: workflowRuns.retryCount,
      errors: workflowRuns.errors,
      startedAt: workflowRuns.startedAt,
      completedAt: workflowRuns.completedAt,
      createdAt: workflowRuns.createdAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflowId))
    .limit(1);

  if (!workflow) {
    return notFound("Workflow not found");
  }

  // Get step history
  const steps = await getStepHistory(workflowId);

  // Format step status for display
  const formattedSteps = steps.map((step) => ({
    nodeName: step.nodeName,
    status: step.status,
    icon: step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "⏳",
    error: step.error,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
  }));

  // Get state from checkpoint for richer data
  const checkpoint = await loadCheckpoint(workflowId);

  return ok({
    workflow: {
      id: workflow.id,
      bookId: workflow.bookId,
      status: workflow.status,
      currentNode: workflow.currentNode,
      currentChunkIndex: workflow.currentChunkIndex,
      progress: workflow.progress,
      retryCount: workflow.retryCount,
      errors: workflow.errors,
      startedAt: workflow.startedAt,
      completedAt: workflow.completedAt,
      createdAt: workflow.createdAt,
    },
    steps: formattedSteps,
    state: checkpoint
      ? {
          currentNode: checkpoint.lastNode,
          progress: checkpoint.progress,
          recoveredAt: checkpoint.recoveredAt,
        }
      : null,
  });
});
