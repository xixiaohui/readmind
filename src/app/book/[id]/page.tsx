"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, Loader2, Brain, Quote, Lightbulb, Heart,
  Sparkles, Hash, BarChart3, ArrowLeft, ExternalLink, AlertCircle,
  Play, RotateCcw, Trash2, Image as ImageIcon,
  Users, Activity, Building2, Landmark, PenTool, Church,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface BookData {
  book: { id: string; title: string; author: string | null; status: string; chunkCount: number; createdAt: string };
  analyses: { id: string; type: string; result: unknown }[];
  latestWorkflow: {
    id: string; status: string; progress: number; currentNode: string;
    errors?: { node: string; message: string; timestamp: string }[];
    steps?: { nodeName: string; status: string; error: string | null }[];
  } | null;
  quotes: { id: string; text: string; context: string; category: string; score: number }[];
  themes: { id: string; name: string; description: string; weight: number }[];
}

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteBook = async () => {
    if (!confirm("确认删除这本书及其所有分析数据？此操作不可撤销。")) return;
    setDeleting(true);
    const token = localStorage.getItem("readmind_token");
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`/api/books/${id}`, { method: "DELETE", headers });
    router.push("/library");
  };

  const fetchBook = () => {
    fetch(`/api/books/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => setData(d.data))
      .catch(() => {}) // silently ignore transient errors — next poll will retry
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refresh if workflow is running or pending
  useEffect(() => {
    if (!data?.latestWorkflow) return;
    if (data.latestWorkflow.status !== "running" && data.latestWorkflow.status !== "pending") return;
    const interval = setInterval(fetchBook, 3000);
    return () => clearInterval(interval);
  }, [data?.latestWorkflow?.status, id]);

  const startAnalysis = async () => {
    setTriggering(true);
    try {
      const token = localStorage.getItem("readmind_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/books/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ bookId: id }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          alert("本月免费分析额度已用完（3本/月）。请升级会员继续使用。");
          router.push("/pricing");
          return;
        }
        const err = await res.json().catch(() => ({}));
        console.error("Analysis start failed:", res.status, err);
      }
    } catch (err) {
      console.error("Analysis start network error:", err);
    } finally {
      setTriggering(false);
      fetchBook();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="text-center py-24 text-muted-foreground">未找到书籍</div>;
  }

  const { book, analyses, latestWorkflow, quotes: bookQuotes, themes: bookThemes } = data;

  // Parse analysis results
  const getResult = (type: string) => analyses.find((a) => a.type === type)?.result as Record<string, unknown> | undefined;
  const themeResult = getResult("theme") as { themes?: { name: string; description: string; weight: number; occurrences: number }[] } | undefined;
  const summaryResult = getResult("summary") as { summary?: string } | undefined;
  const emotionResult = getResult("emotion") as { emotions?: { overallTone: string; valenceDistribution: Record<string, number>; emotionArc: { label: string; intensity: number }[] } } | undefined;
  const philosophyResult = getResult("philosophy") as { philosophy?: { primaryFrameworks: { name: string; confidence: number }[]; argumentSummary: string } } | undefined;
  const characterResult = getResult("character") as { characters?: { name: string; role: string; traits: string[]; speechStyle: string; arc: string; relationships: { with: string; type: string; description: string }[] }[]; analysisSummary?: string } | undefined;
  const psychologyResult = getResult("psychology") as { psychologicalThemes?: string[]; characterProfiles?: { character: string; motivations: string[]; biases: string[]; defenses: string[] }[]; groupDynamics?: string; defenseMechanisms?: string } | undefined;
  const sociologyResult = getResult("sociology") as { socialStructure?: string; powerDynamics?: string; normsAndTaboos?: string; collectiveAction?: string; culturalCapital?: string } | undefined;
  const politicalEconomyResult = getResult("politicalEconomy") as { politicalSystem?: string; ideologicalConflicts?: string; economicStructure?: string; classStruggle?: string; institutionalCritique?: string } | undefined;
  const literaryCriticResult = getResult("literaryCritic") as { narrativeTechnique?: string; symbolism?: string; proseStyle?: string; genreAnalysis?: string; intertextuality?: string; literaryMerit?: string } | undefined;
  const religiousResult = getResult("religious") as { beliefSystems?: string; moralFramework?: string; existentialThemes?: string; transcendentExperiences?: string; rituals?: string } | undefined;

  const categoryColors: Record<string, string> = { insight: "bg-blue-400/10 text-blue-400", wisdom: "bg-amber-400/10 text-amber-400", emotional: "bg-rose-400/10 text-rose-400", philosophical: "bg-violet-400/10 text-violet-400", practical: "bg-emerald-400/10 text-emerald-400" };

const pipelineNodes = [
  "init", "loadBook", "splitBook", "embeddingChunks",
  "themeAnalyzer", "summaryAnalyzer", "quoteExtractor",
  "philosophyAnalyzer", "emotionAnalyzer",
  "aggregateResults", "saveAnalysis",
];

const nodeLabel: Record<string, string> = {
  init: "初始化", loadBook: "加载", splitBook: "切分",
  embeddingChunks: "向量化", themeAnalyzer: "主题",
  summaryAnalyzer: "摘要", quoteExtractor: "金句",
  philosophyAnalyzer: "哲学", emotionAnalyzer: "情感",
  aggregateResults: "聚合", saveAnalysis: "保存",
  END: "完成", ERROR: "错误",
};

const nodeDesc: Record<string, string> = {
  init: "正在初始化", loadBook: "正在加载文本",
  splitBook: "正在切分段落", embeddingChunks: "正在生成向量",
  themeAnalyzer: "正在分析主题", summaryAnalyzer: "正在生成摘要",
  quoteExtractor: "正在提取金句", philosophyAnalyzer: "正在识别哲学框架",
  emotionAnalyzer: "正在分析情感", aggregateResults: "正在聚合结果",
  saveAnalysis: "正在保存到数据库",
};

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/library" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft className="h-3 w-3" /> 书库
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{book.title}</h1>
          {book.author && <p className="text-muted-foreground">by {book.author}</p>}
        </div>
        <div className="flex items-center gap-2">
          {latestWorkflow?.status === "running" || latestWorkflow?.status === "pending" ? (
            <Badge className="bg-blue-400/10 text-blue-400"><Loader2 className="h-3 w-3 animate-spin mr-1" /> 分析中</Badge>
          ) : latestWorkflow?.status === "completed" ? (
            <Badge className="bg-emerald-400/10 text-emerald-400"><Sparkles className="h-3 w-3 mr-1" /> 已完成</Badge>
          ) : (
            <Badge variant="secondary">{book.status}</Badge>
          )}
          <button
            onClick={deleteBook}
            disabled={deleting}
            className="p-1.5 rounded-md hover:bg-red-400/10 transition-colors"
            title="删除书籍"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-400" />
            ) : (
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400 transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* Running progress — live node timeline */}
      {(latestWorkflow?.status === "running" || latestWorkflow?.status === "pending") && (() => {
        // Build a set of completed/failed/running nodes from step history
        const steps = latestWorkflow.steps ?? [];
        const stepMap = new Map<string, { status: string; error?: string | null }>();
        for (const s of steps) {
          if (s.status === "completed" || s.status === "failed") {
            stepMap.set(s.nodeName, { status: s.status, error: s.error });
          } else if (s.status === "running" && !stepMap.has(s.nodeName)) {
            stepMap.set(s.nodeName, { status: "running" });
          }
        }

        const currentNode = latestWorkflow.currentNode || "";

        return (
          <Card className="mb-6 border-blue-400/20 bg-blue-400/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  AI 分析流水线
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(latestWorkflow.progress * 100)}%
                </span>
              </div>

              {/* Node timeline */}
              <div className="space-y-1">
                {pipelineNodes.map((node) => {
                  const step = stepMap.get(node);
                  const isCurrent = currentNode === node;

                  let icon: React.ReactNode;
                  let rowClass = "text-muted-foreground/40";

                  if (step?.status === "completed") {
                    icon = <span className="text-emerald-400 text-xs font-bold w-5 text-center">✓</span>;
                    rowClass = "text-emerald-400/80";
                  } else if (step?.status === "failed") {
                    icon = <span className="text-red-400 text-xs font-bold w-5 text-center">✗</span>;
                    rowClass = "text-red-400/80";
                  } else if (isCurrent || step?.status === "running") {
                    icon = <Loader2 className="h-3 w-3 animate-spin text-blue-400 mx-auto" />;
                    rowClass = "text-blue-400";
                  } else {
                    icon = <span className="w-5 h-5 rounded-full border border-muted-foreground/20 inline-block" />;
                  }

                  return (
                    <div key={node} className={`flex items-center gap-2.5 py-1 text-xs transition-colors ${rowClass}`}>
                      <div className="w-5 flex justify-center shrink-0">{icon}</div>
                      <span className="w-20 shrink-0 font-medium">{nodeLabel[node] ?? node}</span>
                      <span className="text-muted-foreground/60 truncate hidden sm:inline">
                        {step?.status === "failed" && step.error
                          ? step.error.slice(0, 60)
                          : isCurrent
                          ? "running…"
                          : step?.status === "completed"
                          ? nodeDesc[node] ?? ""
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex justify-end">
                <Link href={`/workflow/${latestWorkflow.id}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> 查看完整流水线
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {latestWorkflow?.status === "failed" && (
        <div className="mb-6 rounded-lg bg-red-400/10 px-4 py-3 text-sm text-red-400 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" /> 分析失败
          </div>
          {latestWorkflow.errors && latestWorkflow.errors.length > 0 ? (
            <div className="space-y-1 ml-6">
              {latestWorkflow.errors.map((e, i) => (
                <div key={i}>
                  <span className="text-red-400/70">节点：</span> {e.node}
                  <br />
                  <span className="text-red-400/70">错误：</span> {e.message}
                </div>
              ))}
            </div>
          ) : (
            <p className="ml-6 text-red-400/60">暂无错误详情，工作流可能意外崩溃。</p>
          )}
        </div>
      )}

      {/* Analysis Content */}
      {analyses.length > 0 ? (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full justify-start mb-6 overflow-x-auto">
            <TabsTrigger value="summary" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> 摘要</TabsTrigger>
            <TabsTrigger value="themes" className="gap-1"><Hash className="h-3.5 w-3.5" /> 主题</TabsTrigger>
            <TabsTrigger value="quotes" className="gap-1"><Quote className="h-3.5 w-3.5" /> 金句</TabsTrigger>
            <TabsTrigger value="philosophy" className="gap-1"><Brain className="h-3.5 w-3.5" /> 哲学</TabsTrigger>
            <TabsTrigger value="emotions" className="gap-1"><Heart className="h-3.5 w-3.5" /> 情感</TabsTrigger>
            {characterResult && <TabsTrigger value="characters" className="gap-1"><Users className="h-3.5 w-3.5" /> 人物</TabsTrigger>}
            {psychologyResult && <TabsTrigger value="psychology" className="gap-1"><Activity className="h-3.5 w-3.5" /> 心理</TabsTrigger>}
            {sociologyResult && <TabsTrigger value="sociology" className="gap-1"><Building2 className="h-3.5 w-3.5" /> 社会</TabsTrigger>}
            {politicalEconomyResult && <TabsTrigger value="politicalEconomy" className="gap-1"><Landmark className="h-3.5 w-3.5" /> 政经</TabsTrigger>}
            {literaryCriticResult && <TabsTrigger value="literaryCritic" className="gap-1"><PenTool className="h-3.5 w-3.5" /> 文学</TabsTrigger>}
            {religiousResult && <TabsTrigger value="religious" className="gap-1"><Church className="h-3.5 w-3.5" /> 宗教</TabsTrigger>}
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> 摘要</CardTitle>
                  <a
                    href={`/api/books/${book.id}/poster?type=summary`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-primary/10"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> 生成海报
                  </a>
                </div>
              </CardHeader>
              <CardContent><p className="text-muted-foreground leading-relaxed whitespace-pre-line">{summaryResult?.summary ?? "暂无摘要。"}</p></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="themes">
            <div className="flex justify-end mb-3">
              <a
                href={`/api/books/${book.id}/poster?type=themes`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-primary/10"
              >
                <ImageIcon className="h-3.5 w-3.5" /> 生成主题海报
              </a>
            </div>
            <div className="grid gap-3">
              {(themeResult?.themes ?? bookThemes.map((t) => ({ name: t.name, description: t.description ?? "", weight: t.weight, occurrences: 1 }))).map((theme, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{theme.name}</span>
                        {theme.occurrences && theme.occurrences > 1 && <Badge variant="secondary" className="text-xs">×{theme.occurrences}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{theme.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <BarChart3 className="h-3 w-3" />
                      {Math.round(theme.weight * 100)}%
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="quotes">
            <div className="grid gap-3">
              {bookQuotes.map((q, qi) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <p className="text-lg italic leading-relaxed mb-2">&ldquo;{q.text}&rdquo;</p>
                    {q.context && <p className="text-sm text-muted-foreground mb-2">{q.context}</p>}
                    <div className="flex items-center gap-2">
                      <Badge className={categoryColors[q.category] ?? "bg-muted"}>{q.category}</Badge>
                      <span className="text-xs text-muted-foreground">Score: {Math.round(q.score * 100)}%</span>
                      <span className="flex-1" />
                      <a
                        href={`/api/books/${book.id}/poster?type=quote&qi=${qi}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/10"
                        title="生成金句海报"
                      >
                        <ImageIcon className="h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {bookQuotes.length === 0 && <p className="text-muted-foreground text-sm py-4">暂无提取的金句。</p>}
            </div>
          </TabsContent>

          <TabsContent value="philosophy">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> Philosophical Frameworks</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {philosophyResult?.philosophy?.primaryFrameworks?.length ? (
                  <div className="grid gap-2">
                    {philosophyResult.philosophy.primaryFrameworks.map((fw, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="font-medium text-sm">{fw.name}</span>
                        <Badge variant="secondary">{Math.round(fw.confidence * 100)}% confidence</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">未识别到哲学框架。</p>}
                {philosophyResult?.philosophy?.argumentSummary && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-1">Argument Structure</h4>
                      <p className="text-sm text-muted-foreground">{philosophyResult.philosophy.argumentSummary}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emotions">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4" /> Emotional Analysis</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {emotionResult?.emotions ? (
                  <>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Overall Tone</h4>
                      <p className="text-muted-foreground">{emotionResult.emotions.overallTone}</p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Emotion Arc</h4>
                      <div className="space-y-1.5">
                        {(emotionResult.emotions.emotionArc ?? []).map((point, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-32 shrink-0">{point.label}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${point.intensity * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Valence Distribution</h4>
                      <div className="flex gap-2">
                        {Object.entries(emotionResult.emotions.valenceDistribution ?? {}).map(([key, val]) => (
                          <Badge key={key} variant="secondary" className="capitalize">{key}: {Math.round(Number(val) * 100)}%</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                ) : <p className="text-sm text-muted-foreground">暂无情感分析数据。</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Deep Analysis Tabs ──────────────────────────────────── */}
          {characterResult && (
            <TabsContent value="characters">
              <Card>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> 人物分析</CardTitle><a href={`/api/books/${book.id}/poster?type=character`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 海报</a></div></CardHeader>
                <CardContent className="space-y-6">
                  {characterResult.characters?.map((c, i) => (
                    <div key={i} className="border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-lg">{c.name}</span>
                        <Badge variant="secondary" className="text-xs">{c.role}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {c.traits?.map((t, j) => <Badge key={j} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2"><strong>语言风格：</strong>{c.speechStyle}</p>
                      <p className="text-sm text-muted-foreground mb-2"><strong>人物弧光：</strong>{c.arc}</p>
                      {c.relationships?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-medium mb-2">人物关系</p>
                          {c.relationships.map((r, j) => (
                            <div key={j} className="text-xs text-muted-foreground ml-2 mb-1">
                              <Badge variant="secondary" className="text-xs mr-1">{r.with}</Badge>
                              {r.type} — {r.description}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {characterResult.analysisSummary && (
                    <p className="text-sm text-muted-foreground mt-4 italic">{characterResult.analysisSummary}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {psychologyResult && (
            <TabsContent value="psychology">
              <Card>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> 心理学分析</CardTitle><a href={`/api/books/${book.id}/poster?type=psychology`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 海报</a></div></CardHeader>
                <CardContent className="space-y-4">
                  {psychologyResult.psychologicalThemes && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">心理主题</h4>
                      <div className="flex flex-wrap gap-1.5">{psychologyResult.psychologicalThemes.map((t, i) => <Badge key={i} variant="secondary">{t}</Badge>)}</div>
                    </div>
                  )}
                  {psychologyResult.characterProfiles?.map((p, i) => (
                    <div key={i} className="border border-border rounded-lg p-3">
                      <p className="font-medium text-sm mb-2">{p.character}</p>
                      <p className="text-xs text-muted-foreground"><strong>动机：</strong>{p.motivations?.join("、")}</p>
                      <p className="text-xs text-muted-foreground"><strong>认知偏差：</strong>{p.biases?.join("、")}</p>
                      <p className="text-xs text-muted-foreground"><strong>防御机制：</strong>{p.defenses?.join("、")}</p>
                    </div>
                  ))}
                  {psychologyResult.groupDynamics && <p className="text-sm text-muted-foreground"><strong>群体心理：</strong>{psychologyResult.groupDynamics}</p>}
                  {psychologyResult.defenseMechanisms && <p className="text-sm text-muted-foreground"><strong>防御机制总评：</strong>{psychologyResult.defenseMechanisms}</p>}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {sociologyResult && (
            <TabsContent value="sociology">
              <Card>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> 社会学分析</CardTitle><a href={`/api/books/${book.id}/poster?type=sociology`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 海报</a></div></CardHeader>
                <CardContent className="space-y-4">
                  {sociologyResult.socialStructure && <div><h4 className="text-sm font-medium">社会结构</h4><p className="text-sm text-muted-foreground">{sociologyResult.socialStructure}</p></div>}
                  {sociologyResult.powerDynamics && <div><h4 className="text-sm font-medium">权力关系</h4><p className="text-sm text-muted-foreground">{sociologyResult.powerDynamics}</p></div>}
                  {sociologyResult.normsAndTaboos && <div><h4 className="text-sm font-medium">规范与禁忌</h4><p className="text-sm text-muted-foreground">{sociologyResult.normsAndTaboos}</p></div>}
                  {sociologyResult.collectiveAction && <div><h4 className="text-sm font-medium">集体行动</h4><p className="text-sm text-muted-foreground">{sociologyResult.collectiveAction}</p></div>}
                  {sociologyResult.culturalCapital && <div><h4 className="text-sm font-medium">文化资本</h4><p className="text-sm text-muted-foreground">{sociologyResult.culturalCapital}</p></div>}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {politicalEconomyResult && (
            <TabsContent value="politicalEconomy">
              <Card>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> 政治经济分析</CardTitle><a href={`/api/books/${book.id}/poster?type=politicalEconomy`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 海报</a></div></CardHeader>
                <CardContent className="space-y-4">
                  {politicalEconomyResult.politicalSystem && <div><h4 className="text-sm font-medium">政治体制</h4><p className="text-sm text-muted-foreground">{politicalEconomyResult.politicalSystem}</p></div>}
                  {politicalEconomyResult.ideologicalConflicts && <div><h4 className="text-sm font-medium">意识形态冲突</h4><p className="text-sm text-muted-foreground">{politicalEconomyResult.ideologicalConflicts}</p></div>}
                  {politicalEconomyResult.economicStructure && <div><h4 className="text-sm font-medium">经济结构</h4><p className="text-sm text-muted-foreground">{politicalEconomyResult.economicStructure}</p></div>}
                  {politicalEconomyResult.classStruggle && <div><h4 className="text-sm font-medium">阶级矛盾</h4><p className="text-sm text-muted-foreground">{politicalEconomyResult.classStruggle}</p></div>}
                  {politicalEconomyResult.institutionalCritique && <div><h4 className="text-sm font-medium">制度批判</h4><p className="text-sm text-muted-foreground">{politicalEconomyResult.institutionalCritique}</p></div>}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {literaryCriticResult && (
            <TabsContent value="literaryCritic">
              <Card>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><PenTool className="h-4 w-4" /> 文学评论</CardTitle><a href={`/api/books/${book.id}/poster?type=literaryCritic`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 海报</a></div></CardHeader>
                <CardContent className="space-y-4">
                  {literaryCriticResult.narrativeTechnique && <div><h4 className="text-sm font-medium">叙事技巧</h4><p className="text-sm text-muted-foreground">{literaryCriticResult.narrativeTechnique}</p></div>}
                  {literaryCriticResult.symbolism && <div><h4 className="text-sm font-medium">象征与隐喻</h4><p className="text-sm text-muted-foreground">{literaryCriticResult.symbolism}</p></div>}
                  {literaryCriticResult.proseStyle && <div><h4 className="text-sm font-medium">语言风格</h4><p className="text-sm text-muted-foreground">{literaryCriticResult.proseStyle}</p></div>}
                  {literaryCriticResult.genreAnalysis && <div><h4 className="text-sm font-medium">文体特征</h4><p className="text-sm text-muted-foreground">{literaryCriticResult.genreAnalysis}</p></div>}
                  {literaryCriticResult.intertextuality && <div><h4 className="text-sm font-medium">互文性</h4><p className="text-sm text-muted-foreground">{literaryCriticResult.intertextuality}</p></div>}
                  {literaryCriticResult.literaryMerit && <div><h4 className="text-sm font-medium">文学价值</h4><p className="text-sm text-muted-foreground">{literaryCriticResult.literaryMerit}</p></div>}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {religiousResult && (
            <TabsContent value="religious">
              <Card>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Church className="h-4 w-4" /> 宗教与精神分析</CardTitle><a href={`/api/books/${book.id}/poster?type=religious`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 海报</a></div></CardHeader>
                <CardContent className="space-y-4">
                  {religiousResult.beliefSystems && <div><h4 className="text-sm font-medium">信仰体系</h4><p className="text-sm text-muted-foreground">{religiousResult.beliefSystems}</p></div>}
                  {religiousResult.moralFramework && <div><h4 className="text-sm font-medium">道德框架</h4><p className="text-sm text-muted-foreground">{religiousResult.moralFramework}</p></div>}
                  {religiousResult.existentialThemes && <div><h4 className="text-sm font-medium">存在主义议题</h4><p className="text-sm text-muted-foreground">{religiousResult.existentialThemes}</p></div>}
                  {religiousResult.transcendentExperiences && <div><h4 className="text-sm font-medium">超越性体验</h4><p className="text-sm text-muted-foreground">{religiousResult.transcendentExperiences}</p></div>}
                  {religiousResult.rituals && <div><h4 className="text-sm font-medium">仪式实践</h4><p className="text-sm text-muted-foreground">{religiousResult.rituals}</p></div>}
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      ) : book.status === "failed" || latestWorkflow?.status === "failed" ? (
        /* Failed — show retry button */
        <Card className="border-dashed border-red-400/30">
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <AlertCircle className="h-12 w-12 text-red-400/60" />
            <p className="text-muted-foreground font-medium">分析失败</p>
            <p className="text-sm text-muted-foreground/70 text-center max-w-sm">
              分析过程中出现错误，可以在不重新上传的情况下重试。
            </p>
            <Button onClick={startAnalysis} disabled={triggering} variant="outline" className="gap-2">
              {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              重试分析
            </Button>
          </CardContent>
        </Card>
      ) : book.status === "uploaded" ? (
        /* Uploaded but no workflow — show start button */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <Lightbulb className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">等待分析</p>
            <p className="text-sm text-muted-foreground/70">启动 AI 工作流，解锁深度认知洞察</p>
            <Button onClick={startAnalysis} disabled={triggering} className="gap-2">
              {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              开始分析
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Transitional state (analyzing/pending with no data yet) */
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>正在分析你的书籍…</p>
        </div>
      )}
    </div>
  );
}
