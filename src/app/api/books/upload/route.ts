// ---------------------------------------------------------------------------
// POST /api/books/upload
// ---------------------------------------------------------------------------
// Upload a book for analysis. Accepts title, optional author, and full text.
// Creates a book record in PostgreSQL with status "uploaded".
// Returns the book ID for use with /api/books/analyze.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books } from "@/lib/db/schema";
import { UploadBookSchema } from "@/lib/api/validators";
import { authenticate } from "@/lib/auth";
import { created, badRequest, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

export const POST = withErrorHandler(async (request: Request) => {
  const user = await authenticate(request);
  if (!user) return error("UNAUTHORIZED", "Login required", 401);

  const body = await request.json();

  // Validate input
  const parsed = UploadBookSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const { title, author, text } = parsed.data;

  // Create book record
  const [book] = await db
    .insert(books)
    .values({
      userId: user.sub,
      title,
      author: author ?? null,
      rawText: text,
      status: "uploaded",
    })
    .returning({
      id: books.id,
      title: books.title,
      author: books.author,
      status: books.status,
      createdAt: books.createdAt,
    });

  if (!book) {
    return badRequest("Failed to create book record");
  }

  return created(
    {
      bookId: book.id,
      title: book.title,
      author: book.author,
      status: book.status,
      createdAt: book.createdAt,
    },
    { textLength: text.length }
  );
});
