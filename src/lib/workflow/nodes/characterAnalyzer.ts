// Node: characterAnalyzer — full-book character and relationship analysis
import { z } from "zod/v4";
import { llmClient } from "@/lib/llm/client";
import type { BookAnalysisStateType } from "../state";

const schema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    role: z.string(),
    traits: z.array(z.string()),
    speechStyle: z.string(),
    arc: z.string(),
    relationships: z.array(z.object({
      with: z.string(),
      type: z.string(),
      description: z.string(),
    })),
  })),
  analysisSummary: z.string(),
});

export async function characterAnalyzer(state: BookAnalysisStateType) {
  const summary = state.aggregatedResult?.summary ?? "";
  const themes = state.aggregatedResult?.themes?.map(t => t.name).join("、") ?? "";
  const quotes = state.quotes?.flatMap(q => q.quotes ?? []).slice(0, 10).map(q => q.text).join("\n") ?? "";
  const textSample = state.rawText?.slice(0, 12000) ?? "";

  const messages = [
    { role: "system" as const, content: `你是一位文学人物分析专家。基于全书文本，识别并深度解读所有重要人物。

对每个人物分析：
1. 角色定位（主角/反派/配角）
2. 性格特质（至少3-5个关键词）
3. 语言风格（用词习惯、句式特点、修辞偏好）
4. 人物弧光（成长轨迹、转折点、结局）
5. 人物关系网络（与其他人物的关系类型和深度）

输出 JSON：
{
  "characters": [{ "name": "人物名", "role": "protagonist", "traits": ["勇敢","矛盾"], "speechStyle": "简洁有力，多用短句", "arc": "从天真到成熟的成长历程", "relationships": [{"with":"对方名","type":"师徒","description":"..."}] }],
  "analysisSummary": "200字以内的人物群像总结"
}` },
    { role: "user" as const, content: `全书摘要：${summary.slice(0, 2000)}\n核心主题：${themes}\n精彩金句：${quotes.slice(0, 2000)}\n文本片段：${textSample.slice(0, 8000)}\n\n请分析书中所有重要人物。` },
  ];

  const result = await llmClient.chatJSON(messages, schema);
  return { characterAnalysis: result, currentNode: "characterAnalyzer" };
}
