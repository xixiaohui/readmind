// ---------------------------------------------------------------------------
// Node: loadBook
// ---------------------------------------------------------------------------
// First node in the workflow. Reads the book from PostgreSQL and loads
// the full raw text + metadata into Workflow State.
//
// This is the bridge: PostgreSQL → LangGraph State
// Demonstrates the State → DB → State closed loop.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { BookAnalysisStateType } from "../state";

export async function loadBook(
  state: BookAnalysisStateType
): Promise<Partial<BookAnalysisStateType>> {
  const { bookId } = state;

  // Fetch book from PostgreSQL
  const rows = await db
    .select({
      title: books.title,
      rawText: books.rawText,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  const book = rows[0];
  if (!book) {
    throw new Error(`Book not found: ${bookId}`);
  }

  return {
    title: book.title,
    rawText: book.rawText,
    currentNode: "loadBook",
    workflowStatus: "running",
  };
}
