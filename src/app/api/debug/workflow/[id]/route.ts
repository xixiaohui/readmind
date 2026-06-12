// ---------------------------------------------------------------------------
// GET /api/debug/workflow/[id]
// ---------------------------------------------------------------------------
// Debug endpoint: returns raw database records for a workflow.
// Only works in development mode.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { workflowRuns, workflowSteps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Debug endpoints only available in development" },
      { status: 403 }
    );
  }

  const { id: workflowId } = await params;

  // Get raw workflow record
  const [workflow] = await db
    .select({
      id: workflowRuns.id,
      bookId: workflowRuns.bookId,
      status: workflowRuns.status,
      currentNode: workflowRuns.currentNode,
      currentChunkIndex: workflowRuns.currentChunkIndex,
      progress: workflowRuns.progress,
      retryCount: workflowRuns.retryCount,
      stateSnapshot: workflowRuns.stateSnapshot,
      startedAt: workflowRuns.startedAt,
      completedAt: workflowRuns.completedAt,
      createdAt: workflowRuns.createdAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflowId))
    .limit(1);

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Get steps
  const steps = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowId, workflowId))
    .orderBy(workflowSteps.createdAt);

  // Parse state snapshot size
  const stateSnapshotStr = workflow.stateSnapshot
    ? JSON.stringify(workflow.stateSnapshot)
    : null;

  return NextResponse.json({
    workflow: {
      ...workflow,
      stateSnapshotSize: stateSnapshotStr ? stateSnapshotStr.length : 0,
      stateSnapshotPreview: workflow.stateSnapshot
        ? {
            chunksCount: (workflow.stateSnapshot as any).chunks?.length ?? 0,
            themesCount: Array.isArray((workflow.stateSnapshot as any).themes)
              ? (workflow.stateSnapshot as any).themes.reduce(
                  (sum: number, t: any) => sum + (t.themes?.length ?? 0),
                  0
                )
              : 0,
            currentChunkIndex: (workflow.stateSnapshot as any).currentChunkIndex ?? 0,
            currentNode: (workflow.stateSnapshot as any).currentNode ?? "",
          }
        : null,
    },
    steps,
    summary: {
      totalSteps: steps.length,
      stepNames: [...new Set(steps.map((s) => s.nodeName))],
    },
  });
}
