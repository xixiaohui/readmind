// ---------------------------------------------------------------------------
// POST /api/books/analyze
// ---------------------------------------------------------------------------
// Starts an AI analysis workflow for a previously uploaded book.
// Also serves as the RETRY endpoint for failed workflows.
//
// Returns 202 Accepted immediately — the workflow runs asynchronously.
// The client should poll GET /api/books/{bookId} for progress.
//
// Body: { bookId }
// Response: 202 { success: true, data: { workflowId, status } }
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { AnalyzeBookSchema } from "@/lib/api/validators";
import { accepted, badRequest, notFound, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";
import { triggerWorkflow } from "@/lib/workflow";

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

  // Verify book exists
  const [book] = await db
    .select({ id: books.id, title: books.title, status: books.status })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) {
    return notFound("Book not found");
  }

  // Launch workflow (fire-and-forget)
  const { workflowId } = await triggerWorkflow({
    bookId,
    userId: user.sub,
    title: book.title,
  });

  // Update book status to reflect analysis is running
  await db
    .update(books)
    .set({ status: "analyzing" })
    .where(eq(books.id, bookId));

  return accepted({
    workflowId,
    status: "running",
    bookId,
    title: book.title,
  });
});
