import type { Config } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

// Load .env.local so Drizzle Kit can read DATABASE_URL
loadEnvConfig(process.cwd());

export default {
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
