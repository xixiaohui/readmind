"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import WorkflowVisualization from "@/components/workflow/WorkflowVisualization";

interface WorkflowData {
  workflow: {
    id: string; bookId: string; status: string; currentNode: string;
    currentChunkIndex: number; progress: number;
    retryCount: number; errors: unknown;
    startedAt: string; completedAt: string; createdAt: string;
  };
  steps: { nodeName: string; status: string; icon: string; error: string | null; startedAt: string | null; completedAt: string | null }[];
  state: { currentNode: string; progress: number } | null;
}

const nodeLabel: Record<string, string> = {
  init: "初始化", loadBook: "加载文本", splitBook: "文本切分", embeddingChunks: "向量嵌入",
  themeAnalyzer: "主题分析", summaryAnalyzer: "摘要生成", quoteExtractor: "金句提取",
  philosophyAnalyzer: "哲学分析", emotionAnalyzer: "情绪分析",
  aggregateResults: "结果聚合", saveAnalysis: "保存结果",
  END: "完成", ERROR: "错误",
};

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      fetch(`/api/workflows/${id}`)
        .then((r) => r.json())
        .then((d) => setData(d.data))
        .finally(() => setLoading(false));
    };
    fetchData();
    // Auto-refresh while running
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="text-center py-24 text-muted-foreground">Workflow not found</div>;
  }

  const { workflow, steps } = data;
  const isActive = workflow.status === "running" || workflow.status === "pending";

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/book/${workflow.bookId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-3 w-3" /> Back to Book
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflow Progress</h1>
          <p className="text-muted-foreground text-sm mt-1">AI Analysis Pipeline</p>
        </div>
        <Badge className={isActive ? "bg-blue-400/10 text-blue-400" : workflow.status === "completed" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}>
          {isActive && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
          {workflow.status}
        </Badge>
      </div>

      {/* Progress Bar */}
      {isActive && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(workflow.progress * 100)}%</span>
            </div>
            <Progress value={workflow.progress * 100} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Current: {nodeLabel[workflow.currentNode] ?? workflow.currentNode}</span>
              {workflow.currentChunkIndex > 0 && <span>Chunk {workflow.currentChunkIndex}</span>}
              {workflow.retryCount > 0 && <span>Retries: {workflow.retryCount}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Visualization */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
        <CardContent>
          <WorkflowVisualization currentNode={workflow.currentNode} steps={steps} />
        </CardContent>
      </Card>

      {/* Step History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Step History</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            {steps.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No steps recorded yet</p>}
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                step.status === "completed" ? "bg-emerald-400/5" :
                step.status === "failed" ? "bg-red-400/5" :
                step.status === "running" ? "bg-blue-400/5" : ""
              }`}>
                <span className="w-6 text-center font-mono">{step.icon}</span>
                <span className="flex-1 font-medium">{nodeLabel[step.nodeName] ?? step.nodeName}</span>
                <span className="text-xs text-muted-foreground capitalize">{step.status}</span>
                {step.error && <span className="text-xs text-red-400 truncate max-w-48">{step.error}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timing */}
      {(workflow.startedAt || workflow.completedAt) && (
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          {workflow.startedAt && <span>Started: {new Date(workflow.startedAt).toLocaleString()}</span>}
          {workflow.completedAt && <span>Completed: {new Date(workflow.completedAt).toLocaleString()}</span>}
          {workflow.startedAt && workflow.completedAt && (
            <span>Duration: {Math.round((new Date(workflow.completedAt).getTime() - new Date(workflow.startedAt).getTime()) / 1000)}s</span>
          )}
        </div>
      )}
    </div>
  );
}
