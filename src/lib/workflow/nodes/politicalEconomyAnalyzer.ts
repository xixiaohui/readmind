// Node: politicalEconomyAnalyzer — political and economic analysis
import { z } from "zod/v4";
import { llmClient } from "@/lib/llm/client";
import type { BookAnalysisStateType } from "../state";

const schema = z.object({
  politicalSystem: z.string(),
  ideologicalConflicts: z.string(),
  economicStructure: z.string(),
  classStruggle: z.string(),
  institutionalCritique: z.string(),
});

export async function politicalEconomyAnalyzer(state: BookAnalysisStateType) {
  const summary = state.aggregatedResult?.summary ?? "";
  const themes = state.aggregatedResult?.themes?.map(t => t.name).join("、") ?? "";
  const philosophy = JSON.stringify(state.aggregatedResult?.philosophy ?? {});

  const messages = [
    { role: "system" as const, content: `你是一位政治经济学分析专家。分析书中政治体制、经济结构和意识形态的互动。

分析维度：
1. 政治体制（书中世界观的政治组织形式，包括非正式权力结构）
2. 意识形态冲突（不同思想体系在叙事中的碰撞）
3. 经济基础（生产方式、资源分配机制、贸易关系）
4. 阶级矛盾（不同利益群体间的博弈和冲突）
5. 制度批判（作者对现有制度的隐含评价或批判）

输出 JSON：{"politicalSystem":"政治体制","ideologicalConflicts":"意识形态冲突","economicStructure":"经济结构","classStruggle":"阶级斗争","institutionalCritique":"制度批判"}` },
    { role: "user" as const, content: `全书摘要：${summary.slice(0, 2000)}\n核心主题：${themes}\n哲学框架：${philosophy.slice(0, 1000)}\n\n请从政治经济学角度进行深度分析。` },
  ];

  const result = await llmClient.chatJSON(messages, schema);
  return { politicalEconomyAnalysis: result, currentNode: "politicalEconomyAnalyzer" };
}
