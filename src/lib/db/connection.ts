import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Database Connection — Production-Grade PostgreSQL + pgvector
// ---------------------------------------------------------------------------
// Uses a singleton Pool pattern so we don't exhaust connections during
// development hot-reload. In production (serverless), connection pooling
// is managed by the platform (Vercel, AWS RDS Proxy, etc.).

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Check your .env.local file.");
  }

  const isProd = process.env.NODE_ENV === "production";

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless-friendly pool sizing:
    // - Vercel functions handle 1 request at a time; keep max low
    // - Short idle timeout to release connections between invocations
    max: isProd ? 3 : 20,
    idleTimeoutMillis: isProd ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    // Vercel serverless requires SSL for external databases
    ...(isProd && {
      ssl: { rejectUnauthorized: false },
    }),
  });
}

const pool = globalForDb.pool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool);

export { pool };
