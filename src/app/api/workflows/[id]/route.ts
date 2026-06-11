// ---------------------------------------------------------------------------
// GET /api/workflows/[id]
// ---------------------------------------------------------------------------
// Returns the current status and progress of a workflow run with full details.
// ---------------------------------------------------------------------------

import { loadCheckpoint, getStepHistory } from "@/lib/workflow/checkpoint";
import { db } from "@/lib/db/connection";
import { workflowRuns, books } from "@/lib/db/schema";
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

  // Get book title
  const [book] = await db
    .select({ title: books.title, author: books.author })
    .from(books)
    .where(eq(books.id, workflow.bookId))
    .limit(1);

  // Get step history
  const steps = await getStepHistory(workflowId);

  // Calculate per-step timing
  const formattedSteps = steps.map((step) => {
    const started = step.startedAt ? new Date(step.startedAt) : null;
    const completed = step.completedAt ? new Date(step.completedAt) : null;
    const durationMs = started && completed ? completed.getTime() - started.getTime() : null;

    return {
      nodeName: step.nodeName,
      status: step.status,
      icon: step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "⏳",
      error: step.error,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      durationMs,
    };
  });

  // Get state from checkpoint for rich details
  const checkpoint = await loadCheckpoint(workflowId).catch(() => null);

  // Extract agent output counts from state
  const state = checkpoint?.state;
  const details = state
    ? {
        chunks: {
          total: state.chunks?.length ?? 0,
          current: state.currentChunkIndex ?? 0,
        },
        agentOutputs: {
          themes: state.themes?.reduce((sum, t) => sum + (t.themes?.length ?? 0), 0) ?? 0,
          summaries: state.summaries?.length ?? 0,
          quotes: state.quotes?.reduce((sum, q) => sum + (q.quotes?.length ?? 0), 0) ?? 0,
          philosophyFrameworks: state.philosophy?.reduce((sum, p) => sum + (p.frameworks?.length ?? 0), 0) ?? 0,
          emotionSnapshots: state.emotions?.length ?? 0,
        },
        // Token estimate: ~4 chars per token for English, ~1.5 for CJK
        textLength: state.rawText?.length ?? 0,
        estimatedTokens: state.chunks?.reduce((sum, c) => sum + (c?.tokenCount ?? 0), 0) ?? 0,
        model: process.env.AI_MODEL ?? "unknown",
        errors: state.errors ?? [],
      }
    : null;

  // Aggregate all completed steps (deduplicate by node, keep latest)
  const stepMap = new Map<string, typeof formattedSteps[number]>();
  for (const step of formattedSteps) {
    const existing = stepMap.get(step.nodeName);
    if (!existing || (step.status === "completed" || step.status === "failed")) {
      stepMap.set(step.nodeName, step);
    }
  }
  const aggregatedSteps = Array.from(stepMap.values());

  // Count completed agent nodes
  const completedNodes = aggregatedSteps.filter((s) => s.status === "completed").length;

  return ok({
    workflow: {
      id: workflow.id,
      bookId: workflow.bookId,
      bookTitle: book?.title ?? "Unknown",
      bookAuthor: book?.author ?? null,
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
    steps: aggregatedSteps,
    details,
    summary: {
      totalSteps: aggregatedSteps.length,
      completedSteps: completedNodes,
      totalDurationMs: workflow.startedAt && workflow.completedAt
        ? new Date(workflow.completedAt).getTime() - new Date(workflow.startedAt).getTime()
        : null,
    },
    state: checkpoint
      ? {
          currentNode: checkpoint.lastNode,
          progress: checkpoint.progress,
          recoveredAt: checkpoint.recoveredAt,
        }
      : null,
  });
});
