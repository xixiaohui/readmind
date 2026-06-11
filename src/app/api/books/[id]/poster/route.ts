// ---------------------------------------------------------------------------
// GET /api/books/[id]/poster?type=summary|quote|themes
// ---------------------------------------------------------------------------
// Generates a shareable PNG poster for a book's analysis using Satori + resvg.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/connection";
import { books, bookAnalysis, quotes, themes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, error } from "@/lib/api/responses";
import { withErrorHandler } from "@/lib/api/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { SummaryPoster, QuotePoster, ThemePoster } from "@/app/poster/PosterRenderer";

// ═══════════════════════════════════════════════════════════════════════════
// Module-level caches (font + WASM initialization)
// ═══════════════════════════════════════════════════════════════════════════

let fontData: ArrayBuffer | null = null;
let wasmInitialized = false;

async function getFont(): Promise<ArrayBuffer> {
  if (fontData) return fontData;

  // Try CDN sources for Chinese font (cached after first load)
  const urls = [
    "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
    "https://cdn.jsdelivr.net/npm/@canvas-fonts/notosanssc@1.0.0/NotoSansSC-Regular.ttf",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        fontData = await res.arrayBuffer();
        console.log(`[Poster] Font loaded from ${url} (${fontData.byteLength} bytes)`);
        return fontData;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Failed to load Chinese font from any source");
}

// ═══════════════════════════════════════════════════════════════════════════
// Palette cycling per book (deterministic from book ID)
// ═══════════════════════════════════════════════════════════════════════════

const PALETTES = [
  { bg: "#1a1a2e", cardBg: "#16213e", accent: "#e2b96f", text: "#f0e6d3", muted: "#c0b090", tag: "#2a2a4e", tagText: "#e2b96f" },
  { bg: "#0d1b2a", cardBg: "#1b2838", accent: "#f4a261", text: "#e8e8e8", muted: "#a0b0c0", tag: "#1b3a4b", tagText: "#f4a261" },
  { bg: "#2d1b2e", cardBg: "#3d2b3e", accent: "#c9a0dc", text: "#f0e0f0", muted: "#c0a0c0", tag: "#4d3b4e", tagText: "#c9a0dc" },
];

function pickPalette(bookId: string) {
  const hash = [...bookId].reduce((s, c) => s + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length]!;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET handler
// ═══════════════════════════════════════════════════════════════════════════

export const GET = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "summary";

  // Load book with analyses, quotes, themes
  const [book] = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  if (!book) return notFound("Book not found");

  // Get analyses
  const analyses = await db
    .select({ analysisType: bookAnalysis.analysisType, result: bookAnalysis.result })
    .from(bookAnalysis)
    .where(eq(bookAnalysis.bookId, bookId));

  const summaryAnalysis = analyses.find((a) => a.analysisType === "summary");

  const bookQuotes = await db
    .select({ id: quotes.id, text: quotes.text, context: quotes.context, category: quotes.category, score: quotes.score })
    .from(quotes)
    .where(eq(quotes.bookId, bookId))
    .orderBy(desc(quotes.score))
    .limit(50);

  const themeRows = await db
    .select({ name: themes.name, weight: themes.weight, description: themes.description })
    .from(themes)
    .where(eq(themes.bookId, bookId))
    .orderBy(desc(themes.weight));
  // Deduplicate themes by name — keep highest weight version
  const themeMap = new Map<string, { name: string; weight: number; description: string }>();
  for (const t of themeRows) {
    const existing = themeMap.get(t.name);
    if (!existing || (t.weight ?? 0) > existing.weight) {
      themeMap.set(t.name, { name: t.name, weight: t.weight ?? 0, description: t.description ?? "" });
    }
  }
  const bookThemes = Array.from(themeMap.values());

  const palette = pickPalette(bookId);

  // Pick the right poster component based on type
  let jsx: React.ReactNode;

  if (type === "quote" && bookQuotes.length > 0) {
    const qIndex = Math.max(0, Math.min(parseInt(searchParams.get("qi") ?? "0", 10) || 0, bookQuotes.length - 1));
    const quote = bookQuotes[qIndex]!;
    jsx = QuotePoster({
      title: book.title,
      author: book.author ?? undefined,
      quoteText: quote.text,
      quoteContext: quote.context ?? undefined,
      quoteCategory: quote.category,
      quoteScore: quote.score ?? undefined,
      index: qIndex,
      total: bookQuotes.length,
      palette,
    });
  } else if (type === "themes") {
    jsx = ThemePoster({
      title: book.title,
      author: book.author ?? undefined,
      themes: bookThemes as { name: string; weight: number; description: string }[],
      palette,
    });
  } else {
    // summary (default)
    const summaryText = (summaryAnalysis?.result as { summary?: string } | undefined)?.summary
      ?? bookQuotes.slice(0, 3).map((q) => q.text).join("；");

    jsx = SummaryPoster({
      title: book.title,
      author: book.author ?? undefined,
      summary: summaryText,
      themeCount: bookThemes.length,
      quoteCount: bookQuotes.length,
      palette,
    });
  }

  // Load font
  const font = await getFont().catch(() => null);
  if (!font) {
    return error("FONT_ERROR", "Failed to load Chinese font", 500);
  }

  // Render SVG via Satori
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(jsx as any, {
    width: 800,
    height: 1200,
    fonts: [
      {
        name: "Noto Sans SC",
        data: Buffer.from(font),
        weight: 400,
        style: "normal",
      },
    ],
  });

  // Debug mode: return raw SVG for inspection
  if (searchParams.get("debug") === "svg") {
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }

  // Convert SVG → PNG via WASM
  const fsMod = await import("node:fs/promises");
  const pathMod = await import("node:path");
  if (!wasmInitialized) {
    const wasmPath = pathMod.resolve(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm");
    const wasmBuffer = await fsMod.readFile(wasmPath);
    await initWasm(wasmBuffer);
    wasmInitialized = true;
  }

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 800 },
  });
  const pngData = resvg.render();
  const pngBytes = pngData.asPng();

  // Stream the PNG bytes using a ReadableStream (avoids Buffer/Blob compat issues)
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(pngBytes);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-cache",
      "Content-Disposition": `inline; filename="${encodeURIComponent(book.title)}-${type}.png"`,
    },
  });
});
