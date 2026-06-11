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
import { SummaryPoster, QuotePoster, ThemePoster, CharacterPoster, GenericAnalysisPoster } from "@/app/poster/PosterRenderer";

// ═══════════════════════════════════════════════════════════════════════════
// Module-level caches (font + WASM initialization)
// ═══════════════════════════════════════════════════════════════════════════

let fontData: ArrayBuffer | null = null;
let wasmInitialized = false;

async function getFont(): Promise<ArrayBuffer> {
  if (fontData) return fontData;

  // Load local font bundled with the project
  try {
    const fsMod = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const fontPath = pathMod.resolve(process.cwd(), "public/fonts/NotoSansCJKsc-Regular.otf");
    const buf = await fsMod.readFile(fontPath);
    fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    console.log(`[Poster] Font loaded from local file (${fontData.byteLength} bytes)`);
    return fontData;
  } catch (e) {
    console.error("[Poster] Failed to load local font:", e);
    throw new Error("Failed to load Chinese font from local file");
  }
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
  } else if (type === "character") {
    const charAnalysis = analyses.find(a => a.analysisType === "character");
    const chars = (charAnalysis?.result as {
      characters?: { name: string; role: string; traits: string[]; speechStyle: string; arc: string; relationships?: { with: string; type: string; description: string }[] }[]
    } | undefined)?.characters ?? [];
    jsx = CharacterPoster({ title: book.title, author: book.author ?? undefined, characters: chars, palette });
  } else if (type === "psychology") {
    const r = analyses.find(a => a.analysisType === "psychology")?.result as Record<string, string> | undefined ?? {};
    jsx = GenericAnalysisPoster({ title: book.title, author: book.author ?? undefined, label: "心理学分析", sections: [
      { label: "心理主题", content: r.psychologicalThemes ?? "" },
      { label: "群体心理", content: r.groupDynamics ?? "" },
      { label: "防御机制", content: r.defenseMechanisms ?? "" },
    ], palette });
  } else if (type === "sociology") {
    const r = analyses.find(a => a.analysisType === "sociology")?.result as Record<string, string> | undefined ?? {};
    jsx = GenericAnalysisPoster({ title: book.title, author: book.author ?? undefined, label: "社会学分析", sections: [
      { label: "社会结构", content: r.socialStructure ?? "" },
      { label: "权力关系", content: r.powerDynamics ?? "" },
      { label: "规范与禁忌", content: r.normsAndTaboos ?? "" },
      { label: "集体行动", content: r.collectiveAction ?? "" },
      { label: "文化资本", content: r.culturalCapital ?? "" },
    ], palette });
  } else if (type === "politicalEconomy") {
    const r = analyses.find(a => a.analysisType === "politicalEconomy")?.result as Record<string, string> | undefined ?? {};
    jsx = GenericAnalysisPoster({ title: book.title, author: book.author ?? undefined, label: "政治经济分析", sections: [
      { label: "政治体制", content: r.politicalSystem ?? "" },
      { label: "意识形态冲突", content: r.ideologicalConflicts ?? "" },
      { label: "经济结构", content: r.economicStructure ?? "" },
      { label: "阶级矛盾", content: r.classStruggle ?? "" },
      { label: "制度批判", content: r.institutionalCritique ?? "" },
    ], palette });
  } else if (type === "literaryCritic") {
    const r = analyses.find(a => a.analysisType === "literaryCritic")?.result as Record<string, string> | undefined ?? {};
    jsx = GenericAnalysisPoster({ title: book.title, author: book.author ?? undefined, label: "文学评论", sections: [
      { label: "叙事技巧", content: r.narrativeTechnique ?? "" },
      { label: "象征与隐喻", content: r.symbolism ?? "" },
      { label: "语言风格", content: r.proseStyle ?? "" },
      { label: "文体特征", content: r.genreAnalysis ?? "" },
      { label: "互文性", content: r.intertextuality ?? "" },
      { label: "文学价值", content: r.literaryMerit ?? "" },
    ], palette });
  } else if (type === "religious") {
    const r = analyses.find(a => a.analysisType === "religious")?.result as Record<string, string> | undefined ?? {};
    jsx = GenericAnalysisPoster({ title: book.title, author: book.author ?? undefined, label: "宗教与精神分析", sections: [
      { label: "信仰体系", content: r.beliefSystems ?? "" },
      { label: "道德框架", content: r.moralFramework ?? "" },
      { label: "存在主义议题", content: r.existentialThemes ?? "" },
      { label: "超越性体验", content: r.transcendentExperiences ?? "" },
      { label: "仪式实践", content: r.rituals ?? "" },
    ], palette });
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
