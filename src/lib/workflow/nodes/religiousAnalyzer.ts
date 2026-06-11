// Node: religiousAnalyzer — religious and spiritual dimension analysis
import { z } from "zod/v4";
import { llmClient } from "@/lib/llm/client";
import type { BookAnalysisStateType } from "../state";

const schema = z.object({
  beliefSystems: z.string(),
  moralFramework: z.string(),
  existentialThemes: z.string(),
  transcendentExperiences: z.string(),
  rituals: z.string(),
});

export async function religiousAnalyzer(state: BookAnalysisStateType) {
  const summary = state.aggregatedResult?.summary ?? "";
  const themes = state.aggregatedResult?.themes?.map(t => t.name).join("、") ?? "";
  const philosophy = JSON.stringify(state.aggregatedResult?.philosophy ?? {});
  const textSample = state.rawText?.slice(0, 8000) ?? "";

  const messages = [
    { role: "system" as const, content: `你是一位宗教与精神分析专家。从信仰、道德和存在主义维度分析书中的精神世界。

分析维度：
1. 信仰体系（书中体现的神论观、泛灵论、无神论等信仰取向）
2. 道德框架（义务论/功利论/德性伦理在人物选择中的体现）
3. 存在主义议题（意义、死亡、自由、孤独等终极追问）
4. 超越性体验（顿悟、恩典、涅槃、启示等超越日常的时刻）
5. 仪式实践（宗教或准宗教仪式在叙事中的功能和象征意义）

注意：即使文本不含明显的宗教内容，也要分析其隐含的精神维度和道德哲学。

输出 JSON：{"beliefSystems":"信仰分析","moralFramework":"道德框架","existentialThemes":"存在主义议题","transcendentExperiences":"超越性体验","rituals":"仪式分析"}` },
    { role: "user" as const, content: `全书摘要：${summary.slice(0, 2000)}\n核心主题：${themes}\n哲学框架：${philosophy.slice(0, 1000)}\n文本片段：${textSample.slice(0, 6000)}\n\n请从宗教与精神维度进行深度分析。` },
  ];

  const result = await llmClient.chatJSON(messages, schema);
  return { religiousAnalysis: result, currentNode: "religiousAnalyzer" };
}
