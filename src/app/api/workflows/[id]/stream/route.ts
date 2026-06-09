// ---------------------------------------------------------------------------
// GET /api/workflows/[id]/stream
// ---------------------------------------------------------------------------
// Server-Sent Events (SSE) endpoint for real-time workflow progress.
//
// Usage (Web):
//   const es = new EventSource("/api/workflows/{id}/stream");
//   es.addEventListener("started", (e) => { ... });
//   es.addEventListener("progress", (e) => { ... });
//   es.addEventListener("completed", (e) => { es.close(); });
//
// Usage (Mobile — iOS/Android):
//   Use standard SSE client library or URLSession (iOS) / OkHttp (Android).
//   The SSE protocol is universally supported.
//
// Events:
//   event: started    — workflow node has started
//   event: progress   — node completed, advancing to next
//   event: completed  — entire workflow finished
//   event: error      — workflow failed
// ---------------------------------------------------------------------------

import { createProgressStream } from "@/lib/api/progress";
import { db } from "@/lib/db/connection";
import { workflowRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: workflowId } = await params;

  // Verify workflow exists
  const [workflow] = await db
    .select({ id: workflowRuns.id, status: workflowRuns.status })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflowId))
    .limit(1);

  if (!workflow) {
    return notFound("Workflow not found");
  }

  // If workflow already completed, return a quick response
  if (workflow.status === "completed" || workflow.status === "failed") {
    const body = `event: ${workflow.status}\ndata: ${JSON.stringify({ workflowId, status: workflow.status })}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Create SSE stream
  const stream = createProgressStream(workflowId);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
});
