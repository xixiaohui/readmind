// ---------------------------------------------------------------------------
// Schema: user_library
// ---------------------------------------------------------------------------
import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { books } from "./books";

export const userLibrary = pgTable(
  "user_library",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at"),
  },
  (table) => ({
    userBookUnique: uniqueIndex("user_book_unique").on(table.userId, table.bookId),
  })
);
