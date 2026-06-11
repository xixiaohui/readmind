"use client";

import { CheckCircle, Loader2, Circle, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Workflow Graph Visualization
// ═══════════════════════════════════════════════════════════════════════════

interface NodeState {
  name: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface WorkflowVisualizationProps {
  currentNode?: string;
  steps?: { nodeName: string; status: string }[];
}

const NODES: { name: string; label: string; row: number; col: number }[] = [
  { name: "loadBook", label: "加载文本", row: 0, col: 0 },
  { name: "splitBook", label: "切分段落", row: 1, col: 0 },
  { name: "embeddingChunks", label: "向量嵌入", row: 2, col: 0 },
  // Parallel branches
  { name: "themeAnalyzer", label: "主题分析", row: 3, col: -1 },
  { name: "summaryAnalyzer", label: "摘要生成", row: 3, col: 0 },
  { name: "quoteExtractor", label: "金句提取", row: 3, col: 1 },
  { name: "emotionAnalyzer", label: "情感分析", row: 4, col: 0 },
  { name: "philosophyAnalyzer", label: "哲学分析", row: 5, col: 0 },
  // Convergence
  { name: "aggregateResults", label: "结果聚合", row: 6, col: 0 },
  { name: "saveAnalysis", label: "保存结果", row: 7, col: 0 },
];

// Build node state from steps
function getNodeState(nodeName: string, currentNode: string | undefined, steps: { nodeName: string; status: string }[]): NodeState["status"] {
  const step = steps?.find((s) => s.nodeName === nodeName);
  if (step?.status === "completed") return "completed";
  if (step?.status === "failed") return "failed";
  if (nodeName === currentNode) return "running";
  return "pending";
}

const statusColor = (status: NodeState["status"]) => {
  switch (status) {
    case "completed": return "border-emerald-400/50 bg-emerald-400/10 text-emerald-400";
    case "running": return "border-blue-400/50 bg-blue-400/10 text-blue-400 animate-pulse";
    case "failed": return "border-red-400/50 bg-red-400/10 text-red-400";
    default: return "border-border bg-muted/50 text-muted-foreground";
  }
};

const StatusIcon = ({ status }: { status: NodeState["status"] }) => {
  switch (status) {
    case "completed": return <CheckCircle className="h-4 w-4" />;
    case "running": return <Loader2 className="h-4 w-4 animate-spin" />;
    case "failed": return <AlertCircle className="h-4 w-4" />;
    default: return <Circle className="h-4 w-4" />;
  }
};

export default function WorkflowVisualization({ currentNode, steps = [] }: WorkflowVisualizationProps) {
  return (
    <div className="relative space-y-1.5">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 mb-2">
        <div className="text-xs text-muted-foreground font-medium text-center">串行阶段</div>
        <div className="text-xs text-muted-foreground font-medium text-center">并行 Agent</div>
        <div className="text-xs text-muted-foreground font-medium text-center">串行阶段</div>
      </div>

      <div className="flex gap-2">
        {/* Sequential Phase 1: load → split → embed */}
        <div className="flex flex-col gap-1.5 w-1/3">
          {NODES.filter((n) => ["loadBook", "splitBook", "embeddingChunks"].includes(n.name)).map((node) => {
            const status = getNodeState(node.name, currentNode, steps);
            return (
              <div key={node.name}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${statusColor(status)}`}>
                  <StatusIcon status={status} />
                  <span className="font-medium truncate">{node.label}</span>
                </div>
                {/* Vertical connector */}
                {node.name !== "embeddingChunks" && (
                  <div className="flex justify-center py-0.5">
                    <div className={`w-0.5 h-3 ${status === "completed" ? "bg-emerald-400/50" : "bg-border"}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Horizontal connector arrows */}
        <div className="flex items-center justify-center w-6 shrink-0">
          <div className="flex flex-col items-center gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-2 h-2 border-t-2 border-r-2 border-border rounded-tr-sm rotate-45" />
            ))}
          </div>
        </div>

        {/* Parallel Phase: 4 agents */}
        <div className="flex flex-col gap-1.5 w-1/3">
          {NODES.filter((n) =>
            ["themeAnalyzer", "summaryAnalyzer", "quoteExtractor", "emotionAnalyzer", "philosophyAnalyzer"].includes(n.name)
          ).map((node) => {
            const status = getNodeState(node.name, currentNode, steps);
            return (
              <div key={node.name}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${statusColor(status)}`}>
                  <StatusIcon status={status} />
                  <span className="font-medium truncate">{node.label}</span>
                </div>
                {node.name === "themeAnalyzer" && (
                  <div className="flex justify-center py-0.5">
                    <div className={`w-0.5 h-3 ${status === "completed" ? "bg-emerald-400/50" : "bg-border"}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Horizontal connector arrows */}
        <div className="flex items-center justify-center w-6 shrink-0">
          <div className="flex flex-col items-center gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-2 h-2 border-t-2 border-r-2 border-border rounded-tr-sm rotate-45" />
            ))}
          </div>
        </div>

        {/* Sequential Phase 2: aggregate → save */}
        <div className="flex flex-col gap-1.5 w-1/3">
          {NODES.filter((n) => ["aggregateResults", "saveAnalysis"].includes(n.name)).map((node) => {
            const status = getNodeState(node.name, currentNode, steps);
            return (
              <div key={node.name}>
                {node.name === "aggregateResults" && (
                  <div className="flex justify-center py-0.5">
                    <div className={`w-0.5 h-3 ${status === "completed" ? "bg-emerald-400/50" : "bg-border"}`} />
                  </div>
                )}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${statusColor(status)}`}>
                  <StatusIcon status={status} />
                  <span className="font-medium truncate">{node.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle className="h-3 w-3 text-emerald-400" /> 完成</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 text-blue-400" /> 运行中</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Circle className="h-3 w-3" /> 等待</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertCircle className="h-3 w-3 text-red-400" /> 失败</span>
      </div>
    </div>
  );
}
