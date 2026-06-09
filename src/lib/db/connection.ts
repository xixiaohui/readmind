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

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    // Production-ready pool sizing:
    // - max: upper bound of simultaneous connections
    // - idleTimeoutMillis: close idle connections after 30s
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

const pool = globalForDb.pool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool);

export { pool };
