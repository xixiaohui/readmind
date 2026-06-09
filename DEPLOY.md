# ReadMeet Insight — Deployment Guide

## Prerequisites

- [Vercel account](https://vercel.com) linked to your GitHub repo
- PostgreSQL 17 + pgvector database (hosted)
  - Recommended: [Neon](https://neon.tech) (serverless PostgreSQL + pgvector)
  - Or: [Supabase](https://supabase.com) (pgvector support), AWS RDS with pgvector extension

## Vercel Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "ReadMeet Insight: production-ready AI cognitive reading platform"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Next.js — no config needed

### 3. Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/readmind?sslmode=require` | PostgreSQL connection (with pgvector) |
| `OPENAI_API_KEY` | `sk-your-deepseek-api-key` | DeepSeek API key |
| `OPENAI_BASE_URL` | `https://api.deepseek.com/v1` | DeepSeek API endpoint |
| `AI_MODEL` | `deepseek-chat` | Default model |
| `JWT_SECRET` | `openssl rand -hex 64` | JWT signing secret |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Public app URL |

### 4. Database Setup

Run these commands before first use:

```bash
# Start local DB and push schema (or connect to your hosted DB)
npm run docker:up          # If using local Docker PostgreSQL
npm run db:push            # Push schema directly (no migration files needed)
# OR
npm run db:migrate         # Apply migrations

# Then apply pgvector indexes manually:
psql $DATABASE_URL -f drizzle/migrations-manual/0000_vector_indexes.sql
```

### 5. Deploy

```bash
npx vercel --prod
```

## Architecture Notes for Production

### Database Connection Pooling

The current setup uses `pg.Pool` which works for moderate traffic. For high-traffic production:

1. Use [Neon Serverless Driver](https://neon.tech/docs/serverless/serverless-driver) — `npm install @neondatabase/serverless`
2. Update `src/lib/db/connection.ts` to use `neon` instead of `pg`

### Background Workflows

`POST /api/books/analyze` starts a background workflow. On Vercel:
- Serverless functions have a 30s max (60s with Pro)
- The workflow returns 202 immediately (fire-and-forget)
- Background processing continues in the Promise chain
- For long-running analysis, consider moving to a dedicated worker

### pgvector Indexes

Remember to run `drizzle/migrations-manual/0000_vector_indexes.sql` after schema setup to create IVFFlat indexes for semantic search.

## Quick Start After Deploy

1. Open `https://your-app.vercel.app`
2. Click Upload → paste a book's text → Upload & Analyze
3. Watch the Workflow Visualization
4. View analysis: Summary, Themes, Quotes, Philosophy, Emotions

---

Built with LangGraph + Next.js + PostgreSQL + pgvector.
