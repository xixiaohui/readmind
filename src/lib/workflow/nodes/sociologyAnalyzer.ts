// Node: sociologyAnalyzer — social structure and dynamics analysis
import { z } from "zod/v4";
import { llmClient } from "@/lib/llm/client";
import type { BookAnalysisStateType } from "../state";

const schema = z.object({
  socialStructure: z.string(),
  powerDynamics: z.string(),
  normsAndTaboos: z.string(),
  collectiveAction: z.string(),
  culturalCapital: z.string(),
});

export async function sociologyAnalyzer(state: BookAnalysisStateType) {
  const summary = state.aggregatedResult?.summary ?? "";
  const themes = state.aggregatedResult?.themes?.map(t => t.name).join("、") ?? "";

  const messages = [
    { role: "system" as const, content: `你是一位社会学分析专家。从社会学视角分析书中描绘的社会结构和人际动态。

分析维度：
1. 社会阶层结构（书中社会的阶级/等级体系）
2. 权力关系（权力在不同群体间的分布和运作机制）
3. 社会规范与禁忌（驱动人物行为的显性和隐性规则）
4. 集体行动逻辑（群体事件的社会动力）
5. 文化资本（教育、品味、社交网络在人物命运中的作用）

输出 JSON：{"socialStructure":"阶层描述","powerDynamics":"权力分析","normsAndTaboos":"规范禁忌","collectiveAction":"集体行动","culturalCapital":"文化资本分析"}` },
    { role: "user" as const, content: `全书摘要：${summary.slice(0, 2000)}\n核心主题：${themes}\n\n请从社会学角度进行深度分析。` },
  ];

  const result = await llmClient.chatJSON(messages, schema);
  return { sociologyAnalysis: result, currentNode: "sociologyAnalyzer" };
}
