// ---------------------------------------------------------------------------
// Schema: payment_orders — membership purchase records
// ---------------------------------------------------------------------------
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const paymentOrders = pgTable("payment_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(), // monthly | quarterly | yearly
  amount: integer("amount").notNull(), // in cents: 5900 = ¥59
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  proofUrl: text("proof_url"), // uploaded screenshot URL
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});
