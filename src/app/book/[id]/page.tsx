"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  BookOpen, Loader2, Brain, Quote, Lightbulb, Heart,
  Sparkles, Hash, BarChart3, ArrowLeft, ExternalLink, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface BookData {
  book: { id: string; title: string; author: string | null; status: string; chunkCount: number; createdAt: string };
  analyses: { id: string; type: string; result: unknown }[];
  latestWorkflow: { id: string; status: string; progress: number; currentNode: string } | null;
  quotes: { id: string; text: string; context: string; category: string; score: number }[];
  themes: { id: string; name: string; description: string; weight: number }[];
}

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/books/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-refresh if workflow is running
  useEffect(() => {
    if (!data?.latestWorkflow || data.latestWorkflow.status !== "running") return;
    const interval = setInterval(() => {
      fetch(`/api/books/${id}`).then((r) => r.json()).then((d) => setData(d.data));
    }, 3000);
    return () => clearInterval(interval);
  }, [data?.latestWorkflow?.status, id]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="text-center py-24 text-muted-foreground">Book not found</div>;
  }

  const { book, analyses, latestWorkflow, quotes: bookQuotes, themes: bookThemes } = data;

  // Parse analysis results
  const getResult = (type: string) => analyses.find((a) => a.type === type)?.result as Record<string, unknown> | undefined;
  const themeResult = getResult("theme") as { themes?: { name: string; description: string; weight: number; occurrences: number }[] } | undefined;
  const summaryResult = getResult("summary") as { summary?: string } | undefined;
  const emotionResult = getResult("emotion") as { emotions?: { overallTone: string; valenceDistribution: Record<string, number>; emotionArc: { label: string; intensity: number }[] } } | undefined;
  const philosophyResult = getResult("philosophy") as { philosophy?: { primaryFrameworks: { name: string; confidence: number }[]; argumentSummary: string } } | undefined;

  const categoryColors: Record<string, string> = { insight: "bg-blue-400/10 text-blue-400", wisdom: "bg-amber-400/10 text-amber-400", emotional: "bg-rose-400/10 text-rose-400", philosophical: "bg-violet-400/10 text-violet-400", practical: "bg-emerald-400/10 text-emerald-400" };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/library" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Library
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{book.title}</h1>
          {book.author && <p className="text-muted-foreground">by {book.author}</p>}
        </div>
        <div className="flex items-center gap-2">
          {latestWorkflow?.status === "running" ? (
            <Badge className="bg-blue-400/10 text-blue-400"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analyzing</Badge>
          ) : latestWorkflow?.status === "completed" ? (
            <Badge className="bg-emerald-400/10 text-emerald-400"><Sparkles className="h-3 w-3 mr-1" /> Complete</Badge>
          ) : (
            <Badge variant="secondary">{book.status}</Badge>
          )}
        </div>
      </div>

      {/* Running progress bar */}
      {latestWorkflow?.status === "running" && (
        <Card className="mb-6 border-blue-400/20 bg-blue-400/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> AI is reading and analyzing…</span>
              <span>{Math.round(latestWorkflow.progress * 100)}%</span>
            </div>
            <Progress value={latestWorkflow.progress * 100} className="h-2" />
            <div className="mt-2 flex justify-end">
              <Link href={`/workflow/${latestWorkflow.id}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Live workflow view
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {latestWorkflow?.status === "failed" && (
        <div className="mb-6 rounded-lg bg-red-400/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Analysis failed. Please try re-uploading.
        </div>
      )}

      {/* Analysis Content */}
      {analyses.length > 0 ? (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full justify-start mb-6 overflow-x-auto">
            <TabsTrigger value="summary" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Summary</TabsTrigger>
            <TabsTrigger value="themes" className="gap-1"><Hash className="h-3.5 w-3.5" /> Themes</TabsTrigger>
            <TabsTrigger value="quotes" className="gap-1"><Quote className="h-3.5 w-3.5" /> Quotes</TabsTrigger>
            <TabsTrigger value="philosophy" className="gap-1"><Brain className="h-3.5 w-3.5" /> Philosophy</TabsTrigger>
            <TabsTrigger value="emotions" className="gap-1"><Heart className="h-3.5 w-3.5" /> Emotions</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Summary</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground leading-relaxed whitespace-pre-line">{summaryResult?.summary ?? "No summary available."}</p></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="themes">
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
              {bookQuotes.map((q) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <p className="text-lg italic leading-relaxed mb-2">&ldquo;{q.text}&rdquo;</p>
                    {q.context && <p className="text-sm text-muted-foreground mb-2">{q.context}</p>}
                    <div className="flex items-center gap-2">
                      <Badge className={categoryColors[q.category] ?? "bg-muted"}>{q.category}</Badge>
                      <span className="text-xs text-muted-foreground">Score: {Math.round(q.score * 100)}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {bookQuotes.length === 0 && <p className="text-muted-foreground text-sm py-4">No quotes extracted.</p>}
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
                ) : <p className="text-sm text-muted-foreground">No philosophical frameworks identified.</p>}
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
                ) : <p className="text-sm text-muted-foreground">No emotional analysis available.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : book.status === "uploaded" ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <Lightbulb className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">Ready for analysis</p>
            <p className="text-sm text-muted-foreground/70">Start the AI workflow to unlock deep cognitive insights</p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Waiting for analysis to begin…</p>
        </div>
      )}
    </div>
  );
}
