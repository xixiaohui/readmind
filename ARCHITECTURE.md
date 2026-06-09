# ReadMeet Insight — Architecture Document

## 一、核心架构决策：为什么是 State Flow 而不是 MVC

### MVC 的问题

传统 MVC 架构：

```
Controller → Service → Repository → DB
```

这个模型对 CRUD 应用有效，但对 **AI Workflow 系统** 有致命缺陷：

1. **Controller 是无状态的** — 每个请求是独立的，但 AI 分析一本书可能需要几分钟
2. **Service 层是同步思维的** — 调用-返回模式无法表达 "处理到一半暂停，等 LLM 返回再继续"
3. **没有 Checkpoint 概念** — 如果处理到第 47 个 chunk 时崩溃，MVC 无法恢复

### State Flow 的答案

```
State (当前状态快照)
  ↓
Node (处理节点：splitBook / themeAnalyzer / ...)
  ↓
Edge (状态转换路径)
  ↓
Conditional Routing (if chunk remaining → 返回上一个 Node)
  ↓
Checkpoint (每一步写入 PostgreSQL)
  ↓
Recovery (从最后 Checkpoint 恢复)
```

**核心原则：系统的真实来源不是数据库的当前行，而是 Workflow State。**

这就像 Git 的 commit graph —— 每个 commit 是完整的 repo 快照。LangGraph 的 State 也是如此：每个 Node 之后都会生成一个 State 快照，存在 Checkpoint 里。

### 为什么这对移动端至关重要

移动端 App 的生命周期不可预测：
- 用户切到后台 → App 可能被杀死
- 网络中断 → HTTP 连接断开
- 设备休眠 → 处理中断

如果 Workflow 绑在 Web 页面的生命周期上，移动端就无法使用。只有 **后端独立运行的 State Machine** 才能做到：
- 手机发起分析请求 → 后端返回 workflowId
- 手机可以关闭 App → 后端继续运行
- 手机重新打开 → 通过 workflowId 查询进度
- Workflow 完成 → 推送通知

---

## 二、系统分层架构

```
┌──────────────────────────────────────────────────────┐
│                    Client Layer                        │
│  Web (Next.js)  │  iOS (Future)  │  Android (Future)  │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP REST + SSE Streaming
┌──────────────────────▼───────────────────────────────┐
│                  API Layer                             │
│  Next.js Route Handlers                               │
│  - Auth (JWT)                                         │
│  - Request validation (Zod)                            │
│  - Response serialization                              │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│               Workflow Engine                          │
│  LangGraph StateGraph                                  │
│  - Orchestrates Multi-Agent execution                  │
│  - Manages Checkpoint / Recovery                       │
│  - Controls Chunk Pipeline flow                        │
│  - Emits progress events via SSE                       │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│               Agent System                             │
│  ThemeAgent │ SummaryAgent │ QuoteAgent                │
│  PhilosophyAgent │ EmotionAgent                        │
│  Each: single responsibility, independent prompt,      │
│  structured JSON output, independent retry             │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│               Data Layer                               │
│  PostgreSQL + pgvector                                 │
│  - books, book_chunks, workflow_runs,                   │
│    workflow_steps, book_analysis, embeddings,           │
│    quotes, themes, user_library                         │
│  - vector indexes for semantic search                   │
│  - JSONB for flexible analysis storage                  │
└──────────────────────────────────────────────────────┘
```

**关键规则：数据流只能从上往下。Agent 永远不直接调用 API Layer；API Layer 永远不直接操作数据库。**

---

## 三、为什么必须是 Multi-Agent（而不是单 Prompt）

用一个 Prompt 处理所有分析（主题+摘要+金句+哲学+情绪）的问题是：

### 单 Prompt 的失败模式

```
"请分析这本书的主题、人物、金句、哲学思想，输出 JSON"
```

| 问题 | 后果 |
|------|------|
| **注意力稀释** | LLM 注意力分散在 5 个任务上，每个都做不深 |
| **输出格式不可控** | 即使要求 JSON，嵌套 5 层深的 JSON 经常格式错误 |
| **单一失败点** | 一个分析出错 = 整个请求重来 |
| **无法并行** | 5 个分析必须串行等待一个 LLM 响应 |
| **Prompt 膨胀** | 试图用一个 Prompt 覆盖所有维度 → Prompt 越来越长 → 边际效应递减 |

### Multi-Agent 的答案

```
ThemeAgent:    "你是文学主题分析专家。分析以下文本的主题..."
SummaryAgent:  "你是结构化摘要专家。为以下文本生成摘要..."
QuoteAgent:    "你是金句鉴赏专家。从文本中提取有洞察力的句子..."
```

每个 Agent：
- **单一职责** — 只做一件事，Prompt 短且精准
- **独立 JSON Schema** — 输出格式由 Zod Schema 约束，不依赖 Prompt 描述
- **独立 Node** — 在 LangGraph 中各自是一个 Node，可以独立重试
- **独立并行** — 5 个 Agent 可以并发调用 LLM（只要它们之间没有数据依赖）
- **独立失败域** — ThemeAgent 失败不影响 SummaryAgent 的结果

---

## 四、为什么 Chunk Pipeline 是必需的

一本书可能有 50 万字。GPT-4 的 context window 是 128K tokens，DeepSeek 是 128K tokens。

### 如果一次性发送整本书

| 问题 | 后果 |
|------|------|
| **Token 成本** | 50 万字 ≈ 700K tokens，每次调用花费巨大 |
| **注意力衰减** | LLM 对长文本中部的信息提取能力显著下降（Lost in the Middle 问题）|
| **无法并行** | 只能串行处理 |
| **超时风险** | 处理 50 万字可能需要几分钟，容易超时 |
| **恢复困难** | 处理到一半失败 = 全部重来 |

### Chunk Pipeline 的答案

```
原始文本 (50万字)
  ↓ RecursiveCharacterTextSplitter
Chunks (每个 ~2000 tokens, 有 overlap)
  ↓
embeddingChunks (每个 chunk → vector, 存入 pgvector)
  ↓
Map Phase (每个 chunk 独立送给 Agent 分析)
  ↓
Reduce Phase (aggregateResults 聚合所有 chunk 的分析结果)
```

**Map-Reduce 模式：**
- Map: 每个 chunk 独立分析（可并行）
- Reduce: 所有 chunk 的结果聚合（最后一步）

这保证了：
- **恒定成本** — 每个 chunk 的 token 成本是固定的
- **可并行** — Map phase 可以并发处理 N 个 chunk
- **精确恢复** — Chunk 47 失败 → 只重试 Chunk 47
- **Lost in the Middle 免疫** — 每个 chunk 都在 LLM 的最佳注意力范围内

---

## 五、Workflow Graph 设计

```
                        ┌─────────┐
                        │  START  │
                        └────┬────┘
                             │
                        ┌────▼────┐
                        │loadBook │
                        └────┬────┘
                             │
                        ┌────▼────┐
                        │splitBook│
                        └────┬────┘
                             │
                        ┌────▼──────────┐
                        │embeddingChunks│
                        └────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
         │ theme  │    │summary │    │ quote  │
         │Analyzer│    │Analyzer│    │Extractor│
         └────┬───┘    └────┬───┘    └────┬───┘
              │              │              │
         ┌────▼───┐    ┌────▼───────┐
         │philoso-│    │  emotion   │
         │ phy    │    │ Analyzer   │
         │Analyzer│    └────┬───────┘
         └────┬───┘         │
              │              │
              └──────┬───────┘
                     │
              ┌──────▼──────┐
              │ aggregate   │
              │ Results     │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ saveAnalysis│
              └──────┬──────┘
                     │
                ┌────▼────┐
                │   END   │
                └─────────┘
```

### 并行分支说明

splitBook 之后，五个 Agent 可以**并行执行**：
- themeAnalyzer, summaryAnalyzer, quoteExtractor 三者无依赖 → 同时运行
- philosophyAnalyzer 依赖 themeAnalyzer 的结果（哲学分析需要先知道主题）
- emotionAnalyzer 独立运行

LangGraph 支持 `addConditionalEdges` 实现 "所有并行分支完成后 → aggregateResults"。

### Checkpoint 策略

每个 Node 执行完毕后，LangGraph 自动保存 State 快照到 PostgreSQL。如果崩溃：
1. 系统检测到 `workflowStatus === "running"` 但最后更新时间 > 阈值
2. 从最后一个成功的 Checkpoint 加载 State
3. 从 `currentNode` 继续执行

---

## 六、API 架构设计

```
POST   /api/books/upload          # 上传电子书文本
  → 201 { bookId, title, chunks }

POST   /api/books/analyze          # 启动分析 Workflow
  → 202 { workflowId, status: "running" }

GET    /api/books/[id]             # 获取书籍信息和所有分析结果
  → 200 { book, analyses, quotes, themes }

GET    /api/analysis/[id]          # 获取单次分析详情
  → 200 { analysis, workflow }

GET    /api/workflows/[id]         # 获取 Workflow 当前状态
  → 200 { workflowId, currentNode, progress, steps }

GET    /api/workflows/[id]/stream  # SSE 实时进度流
  → SSE: event: progress, data: { node, chunk, status }
```

### 为什么用 202 Accepted 而不是 200

`POST /api/books/analyze` 启动的是**异步 Workflow**。它不会在 HTTP 请求内完成。返回 202 告诉客户端："我收到了，正在后台处理，用 workflowId 来查进度"。

这对移动端至关重要 —— 客户端不需要保持 HTTP 连接打开。

---

## 七、数据库 Schema 设计

```
books
  id: UUID (PK)
  user_id: UUID (FK)
  title: TEXT
  author: TEXT (nullable)
  raw_text: TEXT
  chunk_count: INT
  status: TEXT ('uploaded' | 'processing' | 'completed' | 'failed')
  created_at: TIMESTAMP
  updated_at: TIMESTAMP

book_chunks
  id: UUID (PK)
  book_id: UUID (FK → books)
  chunk_index: INT
  content: TEXT
  token_count: INT
  embedding: vector(1536)    ← pgvector
  created_at: TIMESTAMP

workflow_runs
  id: UUID (PK)
  book_id: UUID (FK → books)
  user_id: UUID (FK)
  status: TEXT ('pending' | 'running' | 'completed' | 'failed')
  current_node: TEXT
  current_chunk_index: INT
  progress: FLOAT (0-1)
  state_snapshot: JSONB       ← full LangGraph state
  checkpoint_id: TEXT
  retry_count: INT DEFAULT 0
  errors: JSONB
  started_at: TIMESTAMP
  completed_at: TIMESTAMP

workflow_steps
  id: UUID (PK)
  workflow_id: UUID (FK → workflow_runs)
  node_name: TEXT
  status: TEXT ('pending' | 'running' | 'completed' | 'failed')
  input_data: JSONB
  output_data: JSONB
  error: TEXT
  retry_count: INT DEFAULT 0
  started_at: TIMESTAMP
  completed_at: TIMESTAMP

book_analysis
  id: UUID (PK)
  book_id: UUID (FK → books)
  workflow_id: UUID (FK → workflow_runs)
  analysis_type: TEXT ('theme' | 'summary' | 'quote' | 'philosophy' | 'emotion')
  chunk_index: INT (nullable, NULL = aggregated result)
  result: JSONB
  created_at: TIMESTAMP

embeddings
  id: UUID (PK)
  book_id: UUID (FK → books)
  chunk_id: UUID (FK → book_chunks)
  embedding: vector(1536)
  model: TEXT
  created_at: TIMESTAMP

quotes
  id: UUID (PK)
  book_id: UUID (FK → books)
  analysis_id: UUID (FK → book_analysis)
  text: TEXT
  context: TEXT
  category: TEXT
  score: FLOAT
  created_at: TIMESTAMP

themes
  id: UUID (PK)
  book_id: UUID (FK → books)
  analysis_id: UUID (FK → book_analysis)
  name: TEXT
  description: TEXT
  weight: FLOAT
  evidence: JSONB
  created_at: TIMESTAMP

user_library
  id: UUID (PK)
  user_id: UUID (FK)
  book_id: UUID (FK → books)
  added_at: TIMESTAMP
  last_read_at: TIMESTAMP
  UNIQUE(user_id, book_id)
```

---

## 八、目录与模块架构

```
src/lib/
├── db/                  # Data Layer
│   ├── connection.ts    #   PostgreSQL connection pool
│   └── schema/          #   Drizzle table definitions
│       ├── index.ts     #     barrel export
│       ├── books.ts
│       ├── chunks.ts
│       ├── workflows.ts
│       ├── analysis.ts
│       ├── embeddings.ts
│       ├── quotes.ts
│       ├── themes.ts
│       └── library.ts
│
├── workflow/            # LangGraph Engine
│   ├── state.ts         #   BookAnalysisState type
│   ├── graph.ts         #   StateGraph construction
│   └── nodes/           #   Individual workflow nodes
│       ├── loadBook.ts
│       ├── splitBook.ts
│       ├── embeddingChunks.ts
│       ├── themeAnalyzer.ts
│       ├── summaryAnalyzer.ts
│       ├── quoteExtractor.ts
│       ├── philosophyAnalyzer.ts
│       ├── emotionAnalyzer.ts
│       ├── aggregateResults.ts
│       └── saveAnalysis.ts
│
├── agents/              # Multi-Agent System
│   ├── base.ts          #   Base agent class
│   ├── themeAgent.ts
│   ├── summaryAgent.ts
│   ├── quoteAgent.ts
│   ├── philosophyAgent.ts
│   └── emotionAgent.ts
│
├── pipeline/            # Chunk Pipeline
│   ├── splitter.ts      #   Recursive text splitting
│   ├── embedder.ts      #   Vector embedding generation
│   ├── mapReducer.ts    #   Map-Reduce analysis engine
│   └── aggregator.ts    #   Result aggregation logic
│
├── api/                 # API Utilities
│   ├── validators.ts    #   Zod request schemas
│   ├── responses.ts     #   Standardized API responses
│   └── errors.ts        #   Error handling
│
└── auth/                # Authentication
    ├── jwt.ts           #   JWT sign/verify
    └── middleware.ts     #   Auth middleware

src/app/
├── api/                 # Route Handlers (thin — delegate to lib/)
│   ├── books/
│   ├── analysis/
│   ├── workflows/
│   └── auth/
├── upload/              # Upload page
├── library/             # Library page
├── book/[id]/           # Book detail page
├── analysis/[id]/       # Analysis detail page
└── workflow/[id]/       # Workflow progress page
```

**重要规则：**
- `src/app/api/` 的路由处理器**只做三件事**：解析请求 → 调用 `src/lib/` 的服务 → 返回响应
- 所有业务逻辑、Workflow、Agent 都在 `src/lib/` 中
- 前端组件（`src/app/` 的 page.tsx）通过 API 调用后端，不直接访问数据库或 LLM

---

## 九、下一步实现顺序

根据以上架构，后续开发按此顺序：

| Step | 内容 | 产出 |
|------|------|------|
| 3 | PostgreSQL + Drizzle Schema | 所有表定义、migration 生成 |
| 4 | State Design | `BookAnalysisState` 类型定义 |
| 5 | LangGraph Graph | StateGraph 构建、nodes/edges |
| 6 | Workflow Nodes | 每个 Node 的实现 |
| 7 | LLM Integration | OpenAI/DeepSeek 客户端封装 |
| 8 | Chunk Pipeline | Text splitter, embedder, map-reduce |
| 9 | Multi-Agent | 5 个 Agent 的独立实现 |
| 10 | Aggregator | Map-Reduce 的 Reduce 阶段 |
| 11 | Vector Search | pgvector 语义搜索 |
| 12 | Workflow Tracking | Progress API + DB tracking |
| 13 | Streaming APIs | SSE 实时进度推送 |
| 14 | REST APIs | 完整 API 实现 |
| 15 | Frontend UI | 所有页面实现 |
| 16 | Workflow Visualization | 实时 Workflow 图表 |
| 17 | Mobile-Ready APIs | 移动端适配 |
| 18 | Auth | JWT 认证系统 |
