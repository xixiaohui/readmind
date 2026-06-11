// Node: literaryCriticAnalyzer — literary criticism and narrative analysis
import { z } from "zod/v4";
import { llmClient } from "@/lib/llm/client";
import type { BookAnalysisStateType } from "../state";

const schema = z.object({
  narrativeTechnique: z.string(),
  symbolism: z.string(),
  proseStyle: z.string(),
  genreAnalysis: z.string(),
  intertextuality: z.string(),
  literaryMerit: z.string(),
});

export async function literaryCriticAnalyzer(state: BookAnalysisStateType) {
  const summary = state.aggregatedResult?.summary ?? "";
  const themes = state.aggregatedResult?.themes?.map(t => t.name).join("、") ?? "";
  const quotes = state.quotes?.flatMap(q => q.quotes ?? []).slice(0, 8).map(q => `"${q.text}"`).join("\n") ?? "";

  const messages = [
    { role: "system" as const, content: `你是一位资深文学评论家。从文学批评角度分析作品的叙事艺术和文学价值。

分析维度：
1. 叙事技巧（视角、时态、结构、多线叙事等）
2. 象征与隐喻（核心意象、反复出现的符号及其深层含义）
3. 语言风格（修辞密度、句式特点、语域变化、节奏感）
4. 文体特征（所属文学流派、文体创新）
5. 互文性（与其他文学作品的对话、典故、致敬）
6. 文学价值评判（原创性、情感力量、思想深度、艺术成就）

输出 JSON：{"narrativeTechnique":"叙事技巧分析","symbolism":"象征隐喻分析","proseStyle":"语言风格分析","genreAnalysis":"文体分析","intertextuality":"互文性分析","literaryMerit":"文学价值总评"}` },
    { role: "user" as const, content: `全书摘要：${summary.slice(0, 2000)}\n核心主题：${themes}\n精选引文：${quotes.slice(0, 2000)}\n\n请从文学评论角度进行深度分析。` },
  ];

  const result = await llmClient.chatJSON(messages, schema);
  return { literaryCriticAnalysis: result, currentNode: "literaryCriticAnalyzer" };
}
