// ---------------------------------------------------------------------------
// Schema: users
// ---------------------------------------------------------------------------
import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),

    // ── Membership ──
    membershipTier: text("membership_tier").notNull().default("free"),
    // free | monthly | quarterly | yearly
    membershipExpires: timestamp("membership_expires_at"),
    // NULL = never expires (free tier)
    analysisCount: integer("analysis_count").notNull().default(0),
    // resets monthly
    analysisLimit: integer("analysis_limit").notNull().default(3),
    // free=3, paid=-1 (unlimited)

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("uq_users_email").on(table.email),
  })
);
