# Claude Code 开发 Prompt：ReadMind（Production Mobile-Ready AI Cognitive Reading Platform）

你是一位资深：

* AI Workflow Architect
* LangGraph Engineer
* Next.js Fullstack Architect
* Mobile App Architect
* PostgreSQL Architect
* AI Agent System Designer
* Production SaaS Engineer

请帮助我从零开始开发一个：

# ReadMind

这是一个：

# AI Cognitive Reading Platform（AI认知阅读平台）

目标不是：

* 普通电子书阅读器
* ChatGPT聊天工具
* Demo级 AI 项目

而是：

# 可上线 App Store 与 Google Play 的生产级 AI 阅读平台

未来需要：

* iOS App
* Android App
* Web Platform
* AI Workflow Backend
* 多端统一架构

请从第一天开始：

# 按真正商业产品标准设计

而不是 Demo。

---

# 一、产品定位（非常重要）

ReadMind 是：

# AI 深度阅读与认知分析系统

用户上传电子书文本后，系统自动：

* 文本切分
* AI主题分析
* 人物分析
* 情绪分析
* 金句提取
* 思想体系分析
* 摘要生成
* 知识结构提取
* AI阅读洞察生成

系统核心：

# AI Workflow + Multi-Agent + Long Text Cognitive Pipeline

而不是聊天机器人。

---

# 二、最终产品形态（重要）

未来需要：

# Web + iOS + Android

统一系统。

因此架构必须：

# API First Architecture

前后端彻底分离。

---

# 三、技术架构（必须按生产级设计）

## 前端 Web

* Next.js App Router
* TypeScript
* TailwindCSS
* shadcn/ui

## Mobile App（未来）

请从第一天开始：

# 为 React Native / Flutter API 架构做准备

要求：

* 所有业务逻辑后端化
* 不把 Workflow 写在前端
* API 完全可移动端复用

---

# 四、后端架构（核心）

后端必须是：

# AI Workflow Backend

技术：

* Next.js Route Handlers
* LangGraph
* LangChain
* OpenAI SDK（兼容 DeepSeek）
* PostgreSQL
* pgvector
* Drizzle ORM

后端职责：

* Workflow orchestration
* Multi-Agent execution
* Long text processing
* Embedding pipeline
* AI analysis
* Workflow tracking
* Streaming
* Checkpoint recovery

不要：

* 把 AI 逻辑写在前端
* 把 Workflow 写在 React Components
* 做成聊天页面架构

---

# 五、移动端架构要求（非常重要）

未来需要：

# App Store / Google Play 发布

因此：

请从第一天开始：

# 采用 Mobile-Ready Backend Architecture

要求：

* RESTful APIs
* Streaming APIs
* JWT Auth
* Device-safe auth
* Upload APIs
* Async Workflow APIs

Workflow 必须：

# 后端独立运行

而不是依赖 Web 页面生命周期。

---

# 六、数据库要求（生产级）

使用：

# PostgreSQL + pgvector

不要 Supabase。

请设计：

* books
* book_chunks
* workflow_runs
* workflow_steps
* book_analysis
* embeddings
* quotes
* themes
* user_library

要求：

* UUID
* JSONB
* vector indexes
* workflow tracking
* retry metadata
* mobile-safe schema

---

# 七、核心系统架构（最重要）

系统必须：

# Workflow Driven Architecture

不要：

* MVC-heavy
* Controller-heavy
* CRUD-first

而是：

# State Flow Architecture

核心：

State
↓
Node
↓
Edge
↓
Conditional Routing
↓
Checkpoint
↓
Recovery

---

# 八、LangGraph Workflow（核心）

必须真正使用：

* StateGraph
* addNode
* addEdge
* addConditionalEdges
* interrupt
* retry
* checkpoint
* recovery

不要只写 async function。

---

# 九、核心 Workflow

实现：

# Book Analysis Workflow

START
↓
loadBook
↓
splitBook
↓
embeddingChunks
↓
themeAnalyzer
↓
summaryAnalyzer
↓
quoteExtractor
↓
philosophyAnalyzer
↓
emotionAnalyzer
↓
aggregateResults
↓
saveAnalysis
↓
END

---

# 十、State 设计（非常重要）

请专业设计：

# BookAnalysisState

包含：

* workflowId
* userId
* bookId
* title
* rawText
* chunks
* currentChunkIndex
* currentChunk
* themes
* summaries
* quotes
* philosophy
* emotions
* embeddings
* workflowStatus
* currentNode
* retryCount
* errors

要求：

* 扁平结构
* 可序列化
* 可 checkpoint
* 可恢复
* 支持移动端同步
* 支持 workflow resume

请解释：

为什么 AI Workflow 必须 State Driven。

---

# 十一、Chunk Pipeline（核心）

实现：

# Long Text Cognitive Pipeline

要求：

* 自动 chunk
* configurable chunk size
* recursive chunking
* map-reduce analysis
* chunk aggregation
* async processing
* retry support

不要一次性发送整本书给 LLM。

请解释：

为什么生产级 AI 阅读系统必须 Chunk Pipeline。

---

# 十二、Multi-Agent System

实现：

ThemeAgent
SummaryAgent
QuoteAgent
PhilosophyAgent
EmotionAgent

要求：

* 单一职责
* 独立 Prompt
* 独立 JSON 输出
* 独立 Workflow Node

请解释：

为什么 Multi-Agent 比单 Prompt 更稳定。

---

# 十三、LLM 输出规范（生产级）

必须：

# 所有 Agent 输出 JSON

禁止：

自然语言不可控输出。

实现：

* JSON schema validation
* parse retry
* fallback handling
* structured output parsing

---

# 十四、Workflow Tracking System

实现：

# 实时 Workflow Progress System

支持：

* 当前节点
* 当前 Agent
* 当前 chunk
* 当前状态
* retry
* failure
* recovery

例如：

[✓] splitBook
[✓] embeddingChunks
[ ] philosophyAnalyzer

要求：

状态保存在 PostgreSQL。

---

# 十五、Streaming Architecture（重要）

未来移动端需要：

# 实时 AI 分析流

请设计：

* SSE streaming
* async workflow events
* mobile-friendly streaming
* chunk progress events

支持：

* Web
* iOS
* Android

统一协议。

---

# 十六、API First Architecture（重要）

实现：

POST /api/books/upload
POST /api/books/analyze
GET /api/books/[id]
GET /api/analysis/[id]
GET /api/workflows/[id]
GET /api/workflows/[id]/stream

要求：

* Mobile-safe
* Stateless
* JWT auth ready
* Async workflow
* Stream support

---

# 十七、前端 UI（Web）

生成：

/upload
/library
/book/[id]
/analysis/[id]
/workflow/[id]

要求：

* AI产品风格
* 极简高级感
* Workflow Visualization
* Agent Progress UI
* Chunk Progress UI
* Mobile responsive

---

# 十八、Workflow Visualization

实现：

# LangGraph Workflow UI

展示：

START
↓
splitBook
↓
themeAnalyzer
↓
aggregateResults
↓
END

实时高亮：

* 当前节点
* 当前 Agent
* 当前 chunk

---

# 十九、移动端未来兼容（关键）

请从第一天开始：

# 以 Mobile Backend 为核心设计

未来：

* Flutter
* React Native
* Native iOS
* Native Android

都可以直接调用 API。

因此：

* Workflow 必须后端独立运行
* 不依赖 Web Session
* 不依赖浏览器状态

---

# 二十、App Store / Google Play 要求（非常重要）

请从架构层预留：

* Apple Sign In
* Google Sign In
* JWT auth
* User Library
* Reading History
* Subscription System
* Usage Limits
* Background Processing
* Push Notification
* Mobile-safe Upload
* Offline Sync

---

# 二十一、工程规范

代码必须：

* Production-ready
* TypeScript strict mode
* Modular
* Workflow-first
* Mobile-ready
* AI-system architecture
* Scalable
* Maintainable

禁止：

* Demo级代码
* 单文件
* 杂乱 Controller
* 前端堆 AI逻辑

---

# 二十二、开发顺序（严格执行）

必须：

# 按真正生产级 AI 系统开发流程

一步一步生成：

1. Project Initialization
2. Architecture Planning
3. PostgreSQL + Drizzle
4. State Design
5. LangGraph Workflow
6. Workflow Nodes
7. LLM Integration
8. Chunk Pipeline
9. Multi-Agent
10. Aggregator
11. Vector Search
12. Workflow Tracking
13. Streaming APIs
14. REST APIs
15. Frontend UI
16. Workflow Visualization
17. Mobile-ready APIs
18. Auth Architecture
19. Deployment
20. Production Optimization

不要一次性输出全部代码。

每一步：

* 解释为什么这样设计
* 解释 AI Workflow 思维
* 再输出代码

目标：

让我真正理解：

# Production AI Workflow Architecture

而不是复制代码。

---

# 二十三、未来扩展能力（必须预留）

系统未来需要支持：

* AI阅读助手
* AI知识图谱
* AI人物关系图
* AI读书笔记
* AI思维导图
* AI海报生成
* 多语言分析
* Research Agent
* Long-term Memory
* RAG
* Semantic Search
* Multi-Agent Collaboration
* Cognitive Graph

最终目标：

# AI Cognitive Operating System（AI认知操作系统）
