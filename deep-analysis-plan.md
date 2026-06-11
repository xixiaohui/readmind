# 深度分析提升方案

## 两阶段架构

**核心设计**：不增加逐块分析成本。新 Agent 只跑一次，基于全量上下文进行深度解读。

```
Phase 1 (现有，15块×5 Agent = 75次 LLM 调用)
  ─────────────────────────────────────────────
  per-chunk: 主题 | 摘要 | 金句 | 情感 | 哲学
  ↓
  aggregateResults  →  聚合上下文 (摘要 + 主题 + 情感 arc + 哲学框架)

Phase 2 (新增，6 Agent × 1次 = 6次 LLM 调用)  
  ─────────────────────────────────────────────
  full-book context: 人物 | 心理 | 社会 | 政经 | 文学 | 宗教
  ↓
  aggregateDeepResults  →  深度分析报告
```

**成本对比**：
- 现有：~75 次 LLM 调用
- 提升后：~81 次 LLM 调用（仅增加 8%）

---

## 新增 6 个深度分析 Agent

### 1. 人物分析 Agent (`characterAnalyzer`)

**输入**：全书摘要 + 所有金句 + 原始文本的关键对话段落（前后 200 字采样）

**分析维度**：
- 主要人物识别（主角/配角/反派）
- 人物语言风格（用词习惯、句式、修辞偏好）
- 行为模式（决策逻辑、冲突处理、道德选择）
- 人物关系图谱（权力结构、情感纽带、利益冲突）
- 人物弧光（成长轨迹、转折点、结局）

**输出**：`{ characters: [{ name, role, traits, speechStyle, arc, relationships }] }`

### 2. 心理学分析 Agent (`psychologyAnalyzer`)

**输入**：全书摘要 + 情感分析结果 + 主题 + 关键人物行为描述

**分析维度**：
- 角色心理动机（马斯洛需求层次、弗洛伊德人格结构）
- 认知偏差（确认偏误、归因错误、从众效应在叙事中的体现）
- 群体心理（暴民心理、群体极化、社会认同）
- 防御机制（压抑、投射、合理化在角色行为中的表现）
- 心理创伤与修复（PTSD、成长、和解）

**输出**：`{ psychologicalThemes, characterProfiles, groupDynamics, defenseMechanisms }`

### 3. 社会学分析 Agent (`sociologyAnalyzer`)

**输入**：全书摘要 + 主题 + 哲学框架 + 政经分析（如果有）

**分析维度**：
- 社会阶层结构（阶级、地位、流动性）
- 权力关系（父权、官僚、资本、知识权力）
- 社会规范与越轨（习俗、法律、禁忌如何驱动情节）
- 集体行动逻辑（革命、改革、迁徙的社会动力）
- 文化资本与社会再生产（教育、品味、社交圈）

**输出**：`{ socialStructure, powerDynamics, norms, collectiveAction, culturalCapital }`

### 4. 政治经济分析 Agent (`politicalEconomyAnalyzer`)

**输入**：全书摘要 + 主题 + 社会学分析 + 原始文本中涉及政治/经济的段落

**分析维度**：
- 政治体制（书中世界观的政治组织形式）
- 意识形态冲突（自由主义 vs 保守主义、进步 vs 传统）
- 经济基础（生产方式、资源分配、贸易体系）
- 阶级斗争与利益博弈
- 制度批判（作者隐含的政治立场）

**输出**：`{ politicalSystem, ideologicalConflicts, economicStructure, classStruggle, institutionalCritique }`

### 5. 文学评论 Agent (`literaryCriticAnalyzer`)

**输入**：全书摘要 + 所有金句 + 主题 + 情感 arc + 人物分析 + 原始文本精彩段落

**分析维度**：
- 叙事技巧（POV、时态、倒叙、多线叙事）
- 象征与隐喻（核心意象、反复出现的符号）
- 语言风格（修辞密度、句式复杂度、语域切换）
- 文体特征（意识流、书信体、魔幻现实等）
- 互文性（与其他作品的对话、典故引用）
- 文学价值评判（原创性、情感力量、思想深度）

**输出**：`{ narrativeTechnique, symbolism, proseStyle, genreAnalysis, intertextuality, literaryMerit }`

### 6. 宗教哲学分析 Agent (`religiousAnalyzer`)

**输入**：全书摘要 + 哲学框架 + 主题 + 涉及宗教/超验的段落

**分析维度**：
- 信仰体系（神论、泛灵、无神、不可知论）
- 道德框架（义务论、功利论、德性伦理）
- 存在主义问题（意义、死亡、自由、孤独）
- 超越性体验（顿悟、恩典、涅槃、启示）
- 仪式与神圣空间（宗教实践在叙事中的功能）
- 神圣与世俗的张力

**输出**：`{ beliefSystems, moralFramework, existentialThemes, transcendentExperiences, rituals }`

---

## 实现改动

### 图拓扑

```
START → loadBook → splitBook → embeddingChunks
                                    │
     ┌──────────┬──────────┬───┴────┬──────────┐
     ▼          ▼          ▼        ▼          ▼
themeAnalyzer summary   quote     emotion
     │          Analyzer  Extractor Analyzer
     ▼              │          │        │
philosophy          │          │        │
     │              │          │        │
     └──────────────┴──────────┴────────┘
                       │
                  aggregateResults
                       │
    ┌──────┬──────┬─────┼─────┬──────┬──────┐
    ▼      ▼      ▼     │     ▼      ▼      ▼
character psycho socio  │  polit  liter  relig
     │      │      │     │     │      │      │
     └──────┴──────┴─────┼─────┴──────┴──────┘
                       │
                 aggregateDeepResults
                       │
                    saveAnalysis
```

### 文件改动

| # | 操作 | 文件 | 内容 |
|---|------|------|------|
| 1 | 新建 | `src/lib/workflow/nodes/characterAnalyzer.ts` | 人物分析 Agent |
| 2 | 新建 | `src/lib/workflow/nodes/psychologyAnalyzer.ts` | 心理学分析 Agent |
| 3 | 新建 | `src/lib/workflow/nodes/sociologyAnalyzer.ts` | 社会学分析 Agent |
| 4 | 新建 | `src/lib/workflow/nodes/politicalEconomyAnalyzer.ts` | 政经分析 Agent |
| 5 | 新建 | `src/lib/workflow/nodes/literaryCriticAnalyzer.ts` | 文学评论 Agent |
| 6 | 新建 | `src/lib/workflow/nodes/religiousAnalyzer.ts` | 宗教分析 Agent |
| 7 | 新建 | `src/lib/workflow/nodes/aggregateDeepResults.ts` | 聚合所有深度分析 |
| 8 | 修改 | `src/lib/workflow/nodes/index.ts` | 导出新 Agent |
| 9 | 修改 | `src/lib/workflow/state.ts` | 新增 state 字段（deepAnalyses） |
| 10 | 修改 | `src/lib/workflow/graph.ts` | 新拓扑 |
| 11 | 修改 | `src/lib/types.ts` | 新增深度分析类型 |
| 12 | 修改 | `src/app/book/[id]/page.tsx` | 新增深度分析 Tab 展示 |
| 13 | 修改 | `src/lib/db/schema/analysis.ts` | 新增分析类型常量 |

---

## 前端展示

新增 6 个 Tab：人物 | 心理 | 社会 | 政经 | 文学 | 宗教

每个 Tab 以结构化卡片展示分析结果（类似现有的哲学 Tab）。

---

## 执行建议

建议分两批实施，降低单次改动风险：

**第一批**（核心）：人物 + 心理学 + 文学评论 — 这三者对用户体验提升最明显
**第二批**（扩展）：社会学 + 政经 + 宗教 — 更专业的维度

---

确认后我开始实施，先做第一批还是全做？
