// ---------------------------------------------------------------------------
// POST /api/books/analyze
// ---------------------------------------------------------------------------
// Starts an AI analysis workflow for a previously uploaded book.
//
// Returns 202 Accepted immediately — the workflow runs asynchronously.
// The client should poll GET /api/workflows/{workflowId} or subscribe
// to GET /api/workflows/{workflowId}/stream for progress.
//
// Body: { bookId, userId }
// Response: 202 { success: true, data: { workflowId, status } }
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { workflowRuns, books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { AnalyzeBookSchema } from "@/lib/api/validators";
import { accepted, badRequest, notFound, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";
import {
  createInitialState,
  saveCheckpoint,
  type BookAnalysisStateType,
} from "@/lib/workflow";
import { createBookAnalysisGraph } from "@/lib/workflow/graph";
import { progressEmitter } from "@/lib/api/progress";

export const POST = withErrorHandler(async (request: Request) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "Login required", 401);

  const body = await request.json();

  // Validate input
  const parsed = AnalyzeBookSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const { bookId } = parsed.data;
  const userId = user.sub;

  // Verify book exists
  const [book] = await db
    .select({ id: books.id, title: books.title })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) {
    return notFound("Book not found");
  }

  // Create workflow record
  const [workflow] = await db
    .insert(workflowRuns)
    .values({
      bookId,
      userId,
      status: "pending",
    })
    .returning({ id: workflowRuns.id });

  if (!workflow) {
    return badRequest("Failed to create workflow");
  }

  const workflowId = workflow.id;

  // Create initial state and save it
  const state = createInitialState({
    workflowId,
    userId,
    bookId,
    title: book.title,
    rawText: "", // Will be loaded by loadBook node
  });

  await saveCheckpoint({
    workflowId,
    state,
    nodeName: "init",
    status: "pending",
  });

  // Fire-and-forget: run workflow in background
  runWorkflowInBackground(state);

  return accepted({
    workflowId,
    status: "running",
    bookId,
    title: book.title,
  });
});

/**
 * Runs the workflow asynchronously (not awaiting the HTTP response).
 * Progress events are emitted to the SSE system.
 */
function runWorkflowInBackground(state: BookAnalysisStateType): void {
  const graph = createBookAnalysisGraph();

  graph
    .invoke(state, {
      configurable: { thread_id: state.workflowId },
    })
    .then(async (result) => {
      // Emit completion event
      progressEmitter.emit({
        workflowId: state.workflowId,
        node: "END",
        chunkIndex: 0,
        totalChunks: 0,
        status: "completed",
        message: "Analysis complete",
        timestamp: new Date().toISOString(),
      });

      // Load final state and save completed checkpoint
      const finalState = result as unknown as BookAnalysisStateType;
      await saveCheckpoint({
        workflowId: state.workflowId,
        state: { ...finalState, workflowStatus: "completed" },
        nodeName: "END",
        status: "completed",
      });

      progressEmitter.cleanup(state.workflowId);
    })
    .catch(async (err) => {
      console.error(
        `[API] Workflow ${state.workflowId} failed:`,
        err instanceof Error ? err.message : String(err)
      );

      progressEmitter.emit({
        workflowId: state.workflowId,
        node: "ERROR",
        chunkIndex: 0,
        totalChunks: 0,
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      await saveCheckpoint({
        workflowId: state.workflowId,
        state: { ...state, workflowStatus: "failed" },
        nodeName: "ERROR",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });
}
