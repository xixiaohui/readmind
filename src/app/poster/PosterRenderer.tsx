// ---------------------------------------------------------------------------
// Poster JSX Components — Satori-compatible
// ---------------------------------------------------------------------------
// RULES for Satori / Yoga layout:
//   1. Every <div> MUST have display: "flex"
//   2. NO borderLeft/borderRight — use colored <div> sidebars instead
//   3. NO HTML entities — use Unicode characters directly
//   4. NO conditional rendering inside children — use empty strings / arrays
// ---------------------------------------------------------------------------

const FONT = "'Noto Sans SC'";

const PALETTES = [
  { bg: "#1a1a2e", cardBg: "#16213e", accent: "#e2b96f", text: "#f0e6d3", muted: "#c0b090", tag: "#2a2a4e", tagText: "#e2b96f" },
  { bg: "#0d1b2a", cardBg: "#1b2838", accent: "#f4a261", text: "#e8e8e8", muted: "#a0b0c0", tag: "#1b3a4b", tagText: "#f4a261" },
  { bg: "#2d1b2e", cardBg: "#3d2b3e", accent: "#c9a0dc", text: "#f0e0f0", muted: "#c0a0c0", tag: "#4d3b4e", tagText: "#c9a0dc" },
];

function text(s: string): string { return s; }
function num(n: number): string { return String(n); }

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const s = (props: Record<string, unknown>) => ({ ...props }) as Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════════
// Summary Poster
// ═══════════════════════════════════════════════════════════════════════════

export function SummaryPoster(props: {
  title: string; author?: string; summary: string;
  themeCount: number; quoteCount: number;
  palette?: typeof PALETTES[number];
}) {
  const p = props.palette ?? PALETTES[0]!;
  const short = props.summary.length > 480 ? props.summary.slice(0, 480).replace(/\n/g, " ") + "…" : props.summary;
  const author = props.author ?? "";

  return (
    <div style={s({ display: "flex", flexDirection: "column", width: 800, height: 1200, background: p.bg, color: p.text, fontFamily: FONT, padding: 60 })}>
      {/* accent bar */}
      <div style={s({ display: "flex", gap: 8, marginBottom: 50 })}>
        <div style={s({ width: 80, height: 4, background: p.accent, borderRadius: 2 })} />
        <div style={s({ width: 24, height: 4, background: p.accent, borderRadius: 2, opacity: 0.4 })} />
      </div>
      {/* title */}
      <div style={s({ display: "flex", flexDirection: "column", marginBottom: 40 })}>
        <p style={s({ fontSize: 46, fontWeight: 900, letterSpacing: 4, color: p.text, margin: 0 })}>{text(props.title)}</p>
        <p style={s({ fontSize: 20, color: p.muted, margin: 0, marginTop: 12, fontWeight: 300 })}>{text(author)}</p>
      </div>
      {/* highlight */}
      <div style={s({ display: "flex", marginBottom: 36 })}>
        <div style={s({ width: 4, background: p.accent, borderRadius: 2, flexShrink: 0 })} />
        <div style={s({ display: "flex", flex: 1, background: p.cardBg, borderRadius: 16, padding: "36px 40px" })}>
          <p style={s({ fontSize: 22, lineHeight: 1.8, color: p.text, margin: 0, opacity: 0.92 })}>{text(short.slice(0, 200) + "…")}</p>
        </div>
      </div>
      {/* summary body */}
      <div style={s({ display: "flex", flexDirection: "column", flex: 1 })}>
        <p style={s({ fontSize: 18, fontWeight: 700, color: p.accent, margin: 0, marginBottom: 16, letterSpacing: 6 })}>
          {"—"} 摘要 {"—"}
        </p>
        <p style={s({ fontSize: 17, lineHeight: 2, color: p.muted, margin: 0 })}>{text(short)}</p>
      </div>
      {/* footer */}
      <div style={s({ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 40, paddingTop: 30, borderTop: `1px solid ${p.tag}` })}>
        <div style={s({ display: "flex", gap: 20 })}>
          <div style={s({ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: p.tag, borderRadius: 20, fontSize: 14, color: p.tagText })}>
            <p style={s({ fontSize: 14, color: p.tagText, margin: 0 })}>{num(props.themeCount)} 主题</p>
          </div>
          <div style={s({ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: p.tag, borderRadius: 20, fontSize: 14, color: p.tagText })}>
            <p style={s({ fontSize: 14, color: p.tagText, margin: 0 })}>{num(props.quoteCount)} 金句</p>
          </div>
        </div>
        <p style={s({ fontSize: 13, color: p.muted, opacity: 0.5, margin: 0 })}>ReadMeet 洞察</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Quote Poster
// ═══════════════════════════════════════════════════════════════════════════

export function QuotePoster(props: {
  title: string; author?: string; quoteText: string;
  quoteContext?: string; quoteCategory: string; quoteScore?: number;
  index?: number; total?: number;
  palette?: typeof PALETTES[number];
}) {
  const p = props.palette ?? PALETTES[1]!;
  const author = props.author ?? "";
  const ctxText = (props.quoteContext ?? "").length > 200
    ? props.quoteContext!.slice(0, 200) + "…" : (props.quoteContext ?? "");
  const quote = props.quoteText.length > 200
    ? props.quoteText.slice(0, 200) + "…" : props.quoteText;

  const catLabel: Record<string, string> = {
    insight: "洞察", wisdom: "智慧", emotional: "情感",
    philosophical: "哲学", practical: "实践",
  };

  return (
    <div style={s({ display: "flex", flexDirection: "column", width: 800, height: 1200, background: p.bg, color: p.text, fontFamily: FONT, padding: 70 })}>
      {/* accent */}
      <div style={s({ display: "flex", gap: 8, marginBottom: 30 })}>
        <div style={s({ width: 60, height: 3, background: p.accent, borderRadius: 2 })} />
        <div style={s({ width: 16, height: 3, background: p.accent, borderRadius: 2, opacity: 0.4 })} />
      </div>
      {/* quote */}
      <div style={s({ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" })}>
        <p style={s({ fontSize: 160, color: p.accent, opacity: 0.08, margin: 0, lineHeight: 0.5, fontWeight: 900, marginBottom: -40 })}>{"“"}</p>
        <div style={s({ display: "flex" })}>
          <div style={s({ width: 4, background: p.accent, borderRadius: 2, flexShrink: 0 })} />
          <p style={s({ fontSize: 36, lineHeight: 1.75, fontWeight: 600, color: p.text, margin: 0, letterSpacing: 2, paddingLeft: 16 })}>{text(quote)}</p>
        </div>
      </div>
      {/* context */}
      <div style={s({ display: "flex", gap: 0, marginTop: 30, marginBottom: 20 })}>
        <div style={s({ width: 3, background: p.accent, opacity: 0.5, borderRadius: 2, flexShrink: 0 })} />
        <div style={s({ display: "flex", flex: 1, background: p.cardBg, borderRadius: 12, padding: "20px 24px" })}>
          <p style={s({ fontSize: 16, lineHeight: 1.7, color: p.muted, margin: 0 })}>{text(ctxText)}</p>
        </div>
      </div>
      {/* category badge */}
      <div style={s({ display: "flex", marginTop: 0, marginBottom: 20 })}>
        <div style={s({ display: "flex", padding: "10px 24px", background: p.accent, borderRadius: 24, fontSize: 16, fontWeight: 700, color: p.bg, letterSpacing: 4 })}>
          <p style={s({ fontSize: 16, fontWeight: 700, color: p.bg, margin: 0 })}>{text(catLabel[props.quoteCategory] ?? props.quoteCategory)}</p>
        </div>
      </div>
      {/* footer */}
      <div style={s({ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 24, borderTop: `1px solid ${p.tag}` })}>
        <div style={s({ display: "flex", flexDirection: "column", gap: 4 })}>
          <p style={s({ fontSize: 20, fontWeight: 700, color: p.text, margin: 0 })}>{text(props.title)}</p>
          <p style={s({ fontSize: 14, color: p.muted, margin: 0 })}>{text(author)}</p>
          <p style={s({ fontSize: 11, color: p.muted, opacity: 0.4, margin: 0, marginTop: 4 })}>ReadMeet 洞察 {"·"} AI 文学分析</p>
        </div>
        <div style={s({ display: "flex", padding: "8px 20px", background: p.tag, borderRadius: 20, fontSize: 15, fontWeight: 700, color: p.tagText })}>
          <p style={s({ fontSize: 15, fontWeight: 700, color: p.tagText, margin: 0 })}>#{num((props.index ?? 0) + 1)} / {num(props.total ?? 1)}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme Poster
// ═══════════════════════════════════════════════════════════════════════════

export function ThemePoster(props: {
  title: string; author?: string;
  themes: { name: string; weight: number; description: string }[];
  palette?: typeof PALETTES[number];
}) {
  const p = props.palette ?? PALETTES[2]!;
  const author = props.author ?? "";
  const top = [...props.themes].sort((a, b) => b.weight - a.weight).slice(0, 8);

  return (
    <div style={s({ display: "flex", flexDirection: "column", width: 800, height: 1200, background: p.bg, color: p.text, fontFamily: FONT })}>

      {/* ── Hero section ────────────────────────────────────────────────── */}
      <div style={s({ display: "flex", flexDirection: "column", padding: "56px 60px 40px" })}>
        {/* tagline */}
        <div style={s({ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 })}>
          <div style={s({ width: 8, height: 8, borderRadius: 4, background: p.accent })} />
          <p style={s({ fontSize: 13, fontWeight: 700, color: p.accent, letterSpacing: 6, margin: 0 })}>{"主 题 图 谱"}</p>
        </div>
        {/* title */}
        <p style={s({ fontSize: 44, fontWeight: 900, letterSpacing: 2, lineHeight: 1.2, color: p.text, margin: 0 })}>
          {text(props.title)}
        </p>
        <p style={s({ fontSize: 19, color: p.muted, margin: 0, marginTop: 14, fontWeight: 300 })}>
          {text(author)}
        </p>
      </div>

      {/* ── Thick accent line ───────────────────────────────────────────── */}
      <div style={s({ display: "flex", height: 2, background: p.accent, opacity: 0.3, marginLeft: 60, marginRight: 60 })} />

      {/* ── Theme rows ──────────────────────────────────────────────────── */}
      <div style={s({ display: "flex", flexDirection: "column", flex: 1, padding: "36px 60px" })}>
        {top.map((t, i) => {
          const barPct = Math.round(t.weight * 100);
          const desc = t.description?.length > 110 ? t.description.slice(0, 110) + "…" : (t.description ?? "");
          // Alternate accent opacity for visual rhythm
          const accentAlpha = 1 - i * 0.1;

          return (
            <div key={i} style={s({ display: "flex", flexDirection: "column", marginBottom: i < top.length - 1 ? 28 : 0 })}>
              {/* row header */}
              <div style={s({ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 })}>
                {/* rank number */}
                <p style={s({ fontSize: 28, fontWeight: 900, color: p.accent, margin: 0, width: 36, textAlign: "right", opacity: accentAlpha })}>
                  {num(i + 1)}
                </p>
                {/* name */}
                <p style={s({ fontSize: 26, fontWeight: 700, color: p.text, margin: 0, flex: 1 })}>
                  {text(t.name)}
                </p>
                {/* percentage */}
                <p style={s({ fontSize: 22, fontWeight: 800, color: p.accent, margin: 0, opacity: accentAlpha })}>
                  {num(barPct)}{"%"}
                </p>
              </div>
              {/* bar */}
              <div style={s({ display: "flex", paddingLeft: 52 })}>
                <div style={s({ display: "flex", flex: 1, height: 4, background: p.tag, borderRadius: 2, overflow: "hidden" })}>
                  <div style={s({ width: `${Math.max(barPct, 8)}%`, height: 4, background: p.accent, borderRadius: 2, opacity: accentAlpha })} />
                </div>
              </div>
              {/* description */}
              <div style={s({ display: "flex", paddingLeft: 52, marginTop: 6 })}>
                <p style={s({ fontSize: 13, lineHeight: 1.55, color: p.muted, margin: 0, opacity: 0.75 })}>
                  {text(desc)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div style={s({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 60px", borderTop: `1px solid ${p.tag}` })}>
        <div style={s({ display: "flex", alignItems: "center", gap: 14 })}>
          <div style={s({ width: 6, height: 6, borderRadius: 3, background: p.accent, opacity: 0.6 })} />
          <p style={s({ fontSize: 11, color: p.muted, opacity: 0.45, margin: 0 })}>ReadMeet 洞察 {"·"} 文学主题分析</p>
        </div>
        <div style={s({ display: "flex", alignItems: "center", gap: 8 })}>
          <p style={s({ fontSize: 11, color: p.muted, opacity: 0.4, margin: 0 })}>{num(props.themes.length)} 个主题</p>
          <div style={s({ display: "flex", padding: "4px 14px", background: p.tag, borderRadius: 12, fontSize: 12, color: p.tagText })}>
            <p style={s({ fontSize: 12, fontWeight: 700, color: p.tagText, margin: 0 })}>TOP {num(Math.min(top.length, 8))}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
