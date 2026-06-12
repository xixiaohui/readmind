// ---------------------------------------------------------------------------
// GET /api/books/public
// ---------------------------------------------------------------------------
// Public book discovery API.
// Returns all public books with search, filter, sort, and pagination.
// No authentication required — anyone can discover public books.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books, bookAnalysis } from "@/lib/db/schema";
import { eq, like, desc, asc, or, and, sql } from "drizzle-orm";
import { z } from "zod";
import { ok } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.enum(["createdAt", "title", "completedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const GET = withErrorHandler(async (request: Request) => {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { message: "Invalid query parameters", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { page, limit, search, sort, order } = parsed.data;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(books.isPublic, true)]; // Only public books

  if (search) {
    // Use OR condition for search
    conditions.push(
      or(
        like(books.title, `%${search}%`),
        like(books.author, `%${search}%`)
      )!
    );
  }

  // Combine all conditions with AND
  const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(books)
    .where(whereCondition);

  const total = Number(totalResult[0]?.count ?? 0);

  // Build order by
  let orderBy;
  if (sort === "title") {
    orderBy = order === "asc" ? asc(books.title) : desc(books.title);
  } else if (sort === "completedAt") {
    orderBy = order === "asc" ? asc(books.updatedAt) : desc(books.updatedAt);
  } else {
    orderBy = order === "asc" ? asc(books.createdAt) : desc(books.createdAt);
  }

  // Get books
  const publicBooks = await db
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
    .where(whereCondition)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get analysis counts for each book
  const booksWithStats = await Promise.all(
    publicBooks.map(async (book) => {
      const analyses = await db
        .select({ analysisType: bookAnalysis.analysisType })
        .from(bookAnalysis)
        .where(eq(bookAnalysis.bookId, book.id));

      const analysisCount = analyses.length;
      const hasThemes = analyses.some((a) => a.analysisType === "theme");
      const hasQuotes = analyses.some((a) => a.analysisType === "quote");
      const hasSummary = analyses.some((a) => a.analysisType === "summary");

      return {
        ...book,
        stats: {
          analysisCount,
          hasThemes,
          hasQuotes,
          hasSummary,
        },
      };
    })
  );

  return ok({
    books: booksWithStats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
