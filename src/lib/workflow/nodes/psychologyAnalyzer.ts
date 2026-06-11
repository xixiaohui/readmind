// Node: psychologyAnalyzer — psychological depth analysis
import { z } from "zod/v4";
import { llmClient } from "@/lib/llm/client";
import type { BookAnalysisStateType } from "../state";

const schema = z.object({
  psychologicalThemes: z.array(z.string()),
  characterProfiles: z.array(z.object({
    character: z.string(),
    motivations: z.array(z.string()),
    biases: z.array(z.string()),
    defenses: z.array(z.string()),
  })),
  groupDynamics: z.string(),
  defenseMechanisms: z.string(),
});

export async function psychologyAnalyzer(state: BookAnalysisStateType) {
  const summary = state.aggregatedResult?.summary ?? "";
  const emotionArc = JSON.stringify(state.aggregatedResult?.emotions ?? {});
  const themes = state.aggregatedResult?.themes?.map(t => t.name).join("、") ?? "";

  const messages = [
    { role: "system" as const, content: `你是一位心理学分析专家。从心理学视角深度解读书籍中的人物、情节和主题。

分析维度：
1. 心理主题（书中体现的心理学议题，如身份认同、创伤、成长等）
2. 角色心理画像（每个主要人物的深层动机、认知偏差、防御机制）
3. 群体心理（人群互动中的社会心理学现象）
4. 防御机制分析（角色在面对冲突时使用的心理防御方式）

输出 JSON：{"psychologicalThemes":["主题1"],"characterProfiles":[{"character":"名","motivations":[],"biases":[],"defenses":[]}],"groupDynamics":"群体心理描述","defenseMechanisms":"防御机制总评"}` },
    { role: "user" as const, content: `全书摘要：${summary.slice(0, 2000)}\n情感弧光：${emotionArc.slice(0, 1500)}\n核心主题：${themes}\n\n请从心理学角度进行深度分析。` },
  ];

  const result = await llmClient.chatJSON(messages, schema);
  return { psychologyAnalysis: result, currentNode: "psychologyAnalyzer" };
}
