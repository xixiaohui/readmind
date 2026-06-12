"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Radio, Clock, FileText,
  Layers, Cpu, AlertTriangle, CheckCircle, XCircle,
  BarChart3, Zap, BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import WorkflowVisualization from "@/components/workflow/WorkflowVisualization";

interface StepData {
  nodeName: string; status: string; icon: string;
  error: string | null; startedAt: string | null;
  completedAt: string | null; durationMs: number | null;
}

interface DetailData {
  chunks: { total: number; current: number };
  agentOutputs: {
    themes: number; summaries: number; quotes: number;
    philosophyFrameworks: number; emotionSnapshots: number;
  };
  textLength: number;
  estimatedTokens: number;
  model: string;
  errors: { node: string; message: string; timestamp: string }[];
}

interface WorkflowData {
  workflow: {
    id: string; bookId: string; bookTitle: string; bookAuthor: string | null;
    status: string; currentNode: string; currentChunkIndex: number;
    progress: number; retryCount: number; errors: unknown;
    startedAt: string; completedAt: string; createdAt: string;
  };
  steps: StepData[];
  details: DetailData | null;
  summary: {
    totalSteps: number; completedSteps: number; totalDurationMs: number | null;
  };
  state: { currentNode: string; progress: number; recoveredAt?: string } | null;
}

const nodeLabel: Record<string, string> = {
  init: "Init", loadBook: "Load", splitBook: "Split", embeddingChunks: "Embed",
  themeAnalyzer: "Themes", summaryAnalyzer: "Summary", quoteExtractor: "Quotes",
  philosophyAnalyzer: "Philosophy", emotionAnalyzer: "Emotion",
  aggregateResults: "Aggregate", saveAnalysis: "Save",
  END: "Done", ERROR: "Error",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// DeepSeek V4 flash pricing ($/1M tokens)
const INPUT_PRICE = 0.14;
const OUTPUT_PRICE = 0.28;

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = (skipCache = false) => {
    const url = skipCache
      ? `/api/workflows/${id}?_t=${Date.now()}`
      : `/api/workflows/${id}`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data);
        // Clear interval if workflow is done
        if (d.data?.workflow?.status === "completed" || d.data?.workflow?.status === "failed") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();

    // Start polling
    intervalRef.current = setInterval(() => fetchData(), 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="text-center py-24 text-muted-foreground">Workflow not found</div>;
  }

  const { workflow, steps, details, summary } = data;
  const isActive = workflow.status === "running" || workflow.status === "pending";
  const isDone = workflow.status === "completed";
  const isFailed = workflow.status === "failed";

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Link href={`/book/${workflow.bookId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-3 w-3" /> 返回书籍
      </Link>

      {/* ── Analysis Info ──────────────────────────────────────────────────── */}
      <Card className="mb-6 border-blue-400/20 bg-blue-400/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-400/10 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold mb-1">AI 主题分析正在进行中</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                系统正在使用 AI 分析你的书籍内容，包括：识别核心主题、生成章节摘要、提取金句、
                分析哲学框架和情感变化。分析完成后，结果将自动保存到书籍页面。
                {isActive && <span className="text-blue-400"> 页面将每 2 秒自动刷新进度。</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{workflow.bookTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {workflow.bookAuthor && <span>作者：{workflow.bookAuthor} · </span>}
            AI 分析流水线
          </p>
        </div>
        <Badge className={
          isActive ? "bg-blue-400/10 text-blue-400" :
          isDone ? "bg-emerald-400/10 text-emerald-400" :
          "bg-red-400/10 text-red-400"
        }>
          {isActive && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
          {isDone && <CheckCircle className="h-3 w-3 mr-1" />}
          {isFailed && <XCircle className="h-3 w-3 mr-1" />}
          {workflow.status}
        </Badge>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">分块</p>
              <p className="text-lg font-semibold tabular-nums">
                {details ? `${details.chunks.current}/${details.chunks.total}` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">词元</p>
              <p className="text-lg font-semibold tabular-nums">
                {details ? formatTokens(details.estimatedTokens) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">耗时</p>
              <p className="text-lg font-semibold tabular-nums">
                {summary.totalDurationMs != null ? formatDuration(summary.totalDurationMs) : isActive ? "…" : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Model</p>
              <p className="text-sm font-semibold truncate">
                {details?.model ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Progress ────────────────────────────────────────────────────────── */}
      {isActive && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                <span className="font-medium">{nodeLabel[workflow.currentNode] ?? workflow.currentNode}</span>
              </span>
              <span className="text-xs">{Math.round(workflow.progress * 100)}%</span>
            </div>
            <Progress value={workflow.progress * 100} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{summary.completedSteps}/{summary.totalSteps} 个节点完成</span>
              {workflow.retryCount > 0 && <span className="text-amber-400">重试：{workflow.retryCount}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Agent Output Counts (when running or done) ─────────────────────── */}
      {details && (isActive || isDone) && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Agent 产出
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className={`p-2 rounded-md ${details.agentOutputs.themes > 0 ? "bg-emerald-400/5" : "bg-muted/30"}`}>
                <p className="text-lg font-semibold tabular-nums">{details.agentOutputs.themes}</p>
                <p className="text-muted-foreground">主题</p>
              </div>
              <div className={`p-2 rounded-md ${details.agentOutputs.summaries > 0 ? "bg-emerald-400/5" : "bg-muted/30"}`}>
                <p className="text-lg font-semibold tabular-nums">{details.agentOutputs.summaries}</p>
                <p className="text-muted-foreground">摘要</p>
              </div>
              <div className={`p-2 rounded-md ${details.agentOutputs.quotes > 0 ? "bg-emerald-400/5" : "bg-muted/30"}`}>
                <p className="text-lg font-semibold tabular-nums">{details.agentOutputs.quotes}</p>
                <p className="text-muted-foreground">金句</p>
              </div>
              <div className={`p-2 rounded-md ${details.agentOutputs.philosophyFrameworks > 0 ? "bg-emerald-400/5" : "bg-muted/30"}`}>
                <p className="text-lg font-semibold tabular-nums">{details.agentOutputs.philosophyFrameworks}</p>
                <p className="text-muted-foreground">哲学框架</p>
              </div>
              <div className={`p-2 rounded-md ${details.agentOutputs.emotionSnapshots > 0 ? "bg-emerald-400/5" : "bg-muted/30"}`}>
                <p className="text-lg font-semibold tabular-nums">{details.agentOutputs.emotionSnapshots}</p>
                <p className="text-muted-foreground">情感快照</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pipeline Visualization ──────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> 流水线</CardTitle></CardHeader>
        <CardContent>
          <WorkflowVisualization currentNode={workflow.currentNode} steps={steps} />
        </CardContent>
      </Card>

      {/* ── Step History ────────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">步骤历史</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无步骤记录</p>
            )}
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                step.status === "completed" ? "bg-emerald-400/5" :
                step.status === "failed" ? "bg-red-400/5" :
                step.status === "running" ? "bg-blue-400/5" : ""
              }`}>
                <span className="w-6 text-center font-mono">{step.icon}</span>
                <span className="font-medium w-24 shrink-0">{nodeLabel[step.nodeName] ?? step.nodeName}</span>
                <span className="text-xs text-muted-foreground capitalize w-20 shrink-0">{step.status}</span>
                {step.durationMs != null && (
                  <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">{formatDuration(step.durationMs)}</span>
                )}
                {step.error && (
                  <span className="text-xs text-red-400 truncate flex-1 min-w-0" title={step.error}>{step.error}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Error Details ───────────────────────────────────────────────────── */}
      {details && details.errors.length > 0 && (
        <Card className="mb-6 border-red-400/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {details.errors.map((e, i) => (
                <div key={i} className="bg-red-400/5 rounded-md p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs border-red-400/30 text-red-400">{e.node}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <p className="text-red-400/80 text-xs break-all">{e.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Cost Estimate ───────────────────────────────────────────────────── */}
      {details && details.estimatedTokens > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">费用估算</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground">输入词元</p>
                <p className="font-semibold tabular-nums">{formatTokens(details.estimatedTokens)}</p>
                <p className="text-xs text-muted-foreground">${((details.estimatedTokens / 1_000_000) * INPUT_PRICE).toFixed(4)}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground">预估输出</p>
                <p className="font-semibold tabular-nums">~{formatTokens(details.estimatedTokens * 0.3)}</p>
                <p className="text-xs text-muted-foreground">~${((details.estimatedTokens * 0.3 / 1_000_000) * OUTPUT_PRICE).toFixed(4)}</p>
              </div>
              <div className="p-2 rounded-md bg-blue-400/5">
                <p className="text-xs text-muted-foreground">预估总计</p>
                <p className="font-semibold tabular-nums">
                  ~${(
                    (details.estimatedTokens / 1_000_000) * INPUT_PRICE +
                    (details.estimatedTokens * 0.3 / 1_000_000) * OUTPUT_PRICE
                  ).toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {workflow.startedAt && <>Started {new Date(workflow.startedAt).toLocaleString()}</>}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              fetch(`/api/workflows/${id}`)
                .then((r) => r.json())
                .then((d) => setData(d.data))
                .finally(() => setLoading(false));
            }}
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            🔄 刷新
          </button>
          <button
            onClick={() => {
              const json = JSON.stringify(data, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `workflow-${workflow.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            📥 导出 JSON
          </button>
          <Link href={`/book/${workflow.bookId}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <BookOpen className="h-3 w-3" /> 查看分析结果
          </Link>
        </div>
      </div>

      {/* ── Debug Info Card ─────────────────────────────────────────────────── */}
      <Card className="mt-6 border-amber-400/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            🐛 调试信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs">
            {/* Quick Status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">当前节点：</span>
                <span className="font-mono font-semibold">{workflow.currentNode}</span>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">进度：</span>
                <span className="font-mono font-semibold">{Math.round(workflow.progress * 100)}%</span>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">分块：</span>
                <span className="font-mono font-semibold">
                  {details ? `${details.chunks.current}/${details.chunks.total}` : "N/A"}
                </span>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">状态：</span>
                <span className="font-mono font-semibold">{workflow.status}</span>
              </div>
            </div>

            {/* State Summary */}
            {details && (
              <div className="p-2 bg-muted/30 rounded">
                <p className="text-muted-foreground mb-1">State 摘要：</p>
                <pre className="text-xs overflow-auto max-h-32">
{JSON.stringify({
  chunks: `${details.chunks.current}/${details.chunks.total}`,
  agentOutputs: details.agentOutputs,
  textLength: details.textLength,
  estimatedTokens: details.estimatedTokens,
  errors: details.errors.length,
}, null, 2)}
                </pre>
              </div>
            )}

            {/* Raw State (collapsible) */}
            <details className="p-2 bg-muted/30 rounded">
              <summary className="cursor-pointer font-medium hover:text-foreground transition-colors">
                📄 查看完整 State JSON
              </summary>
              <pre className="mt-2 overflow-auto max-h-64 p-2 bg-background rounded border text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>

            {/* Export Button */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const json = JSON.stringify(data, null, 2);
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `workflow-${workflow.id}-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1 bg-amber-400/10 text-amber-400 rounded hover:bg-amber-400/20 transition-colors text-xs"
              >
                📥 下载完整 State
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                  alert("已复制到剪贴板！");
                }}
                className="px-3 py-1 bg-amber-400/10 text-amber-400 rounded hover:bg-amber-400/20 transition-colors text-xs"
              >
                📋 复制 JSON
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
