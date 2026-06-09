// ---------------------------------------------------------------------------
// GET /api/analysis/[id]
// ---------------------------------------------------------------------------
// Returns a specific analysis by its ID, including the full analysis result
// and related workflow information.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { bookAnalysis, workflowRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, notFound } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: analysisId } = await params;

  const [analysis] = await db
    .select({
      id: bookAnalysis.id,
      bookId: bookAnalysis.bookId,
      workflowId: bookAnalysis.workflowId,
      analysisType: bookAnalysis.analysisType,
      chunkIndex: bookAnalysis.chunkIndex,
      result: bookAnalysis.result,
      createdAt: bookAnalysis.createdAt,
    })
    .from(bookAnalysis)
    .where(eq(bookAnalysis.id, analysisId))
    .limit(1);

  if (!analysis) {
    return notFound("Analysis not found");
  }

  // Get the associated workflow info
  const [workflow] = await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      progress: workflowRuns.progress,
      startedAt: workflowRuns.startedAt,
      completedAt: workflowRuns.completedAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, analysis.workflowId))
    .limit(1);

  return ok({
    ...analysis,
    isAggregated: analysis.chunkIndex === null,
    workflow: workflow ?? null,
  });
});
