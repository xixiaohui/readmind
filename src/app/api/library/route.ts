// ---------------------------------------------------------------------------
// GET /api/library
// ---------------------------------------------------------------------------
// Lists books in a user's library with their latest analysis status.
// Supports pagination via ?page=1&limit=20.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books, workflowRuns } from "@/lib/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { PaginationSchema } from "@/lib/api/validators";
import { ok, paginationMeta, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const GET = withErrorHandler(async (request: Request) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "Login required", 401);

  const { searchParams } = new URL(request.url);
  const parsed = PaginationSchema.safeParse({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  });

  const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
  const offset = (page - 1) * limit;
  const userId = user.sub;

  // Get total count
  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(books)
    .where(eq(books.userId, userId));

  const total = countResult?.total ?? 0;

  // Get books with latest workflow status
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      status: books.status,
      chunkCount: books.chunkCount,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(desc(books.updatedAt))
    .limit(limit)
    .offset(offset);

  // Get latest workflow status for each book
  const bookIds = rows.map((r) => r.id);
  let workflowStatuses: Record<string, { status: string; progress: number }> = {};

  if (bookIds.length > 0) {
    // Subquery: latest workflow per book
    const workflowRows = await db
      .select({
        bookId: workflowRuns.bookId,
        status: workflowRuns.status,
        progress: workflowRuns.progress,
      })
      .from(workflowRuns)
      .where(inArray(workflowRuns.bookId, bookIds));

    for (const w of workflowRows) {
      if (
        !workflowStatuses[w.bookId] ||
        w.status === "running"
      ) {
        workflowStatuses[w.bookId] = {
          status: w.status,
          progress: w.progress ?? 0,
        };
      }
    }
  }

  return ok(
    {
      books: rows.map((b) => ({
        ...b,
        workflow: workflowStatuses[b.id] ?? null,
      })),
    },
    paginationMeta(page, limit, total)
  );
});
