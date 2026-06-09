// ---------------------------------------------------------------------------
// BookAnalysisState — The Heart of ReadMeet Insight
// ---------------------------------------------------------------------------
//
// ## Why AI Workflow MUST Be State Driven
//
// A traditional web app works like this:
//
//   Request → Controller → Service → DB → Response
//
// This model assumes: (1) the operation completes in <1 second,
// (2) the client holds the connection open, (3) failure means "start over."
//
// AI book analysis violates ALL three assumptions:
//
//   (1) A 500-page book takes MINUTES to analyze, not milliseconds.
//   (2) Mobile clients disconnect — app goes to background, network drops.
//   (3) Restarting from chunk 0 after a crash at chunk 47 is unacceptable.
//
// A State Machine solves all three:
//
//   State = a COMPLETE snapshot of where we are right now.
//   Each Node reads State → transforms part → returns new State.
//   Between nodes, State is persisted (Checkpoint).
//
// This means:
//
//   ┌─────────────────┐
//   │  Crash at Chunk  │  →  Load last checkpoint → Resume from chunk 47
//   │  47 of 100       │      Not chunk 0. Not the whole book. Just 47.
//   └─────────────────┘
//
//   ┌─────────────────┐
//   │  Mobile app      │  →  GET /api/workflows/{id} → Read state from DB
//   │  needs progress  │      No WebSocket, no polling connection needed.
//   └─────────────────┘
//
//   ┌─────────────────┐
//   │  Debug: why did  │  →  Load state snapshot from workflow_steps
//   │  themeAgent fail?│      See exact input that caused the failure.
//   └─────────────────┘
//
// The State is the CONTRACT. Every Node promises:
//   "Give me a valid State, I'll return a valid State."
// This is how LangGraph enables interrupt/resume/retry/recovery.
//
// ## Design Rules (from dev.md §10)
//
//   ✓ Flat — no deeply nested objects (hard to serialize/merge)
//   ✓ Serializable — JSON.stringify() must work (for JSONB storage)
//   ✓ Checkpointable — every field has a defined reducer
//   ✓ Recoverable — state alone is enough to resume
//   ✓ Mobile-syncable — mobile app reads this via REST API
//   ✓ Type-safe — TypeScript + Zod double validation
// ---------------------------------------------------------------------------

import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type {
  Chunk,
  ThemeResult,
  SummaryResult,
  QuoteResult,
  PhilosophyResult,
  EmotionResult,
  WorkflowStatus,
  WorkflowError,
  AggregatedAnalysis,
} from "@/lib/types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Zod Schemas — Runtime Validation
// ═══════════════════════════════════════════════════════════════════════════
//
// Why Zod + TypeScript?
// TypeScript types disappear at runtime. When we load a state snapshot
// from PostgreSQL (JSONB), we get `any`. Zod validates that the loaded
// data actually conforms to our expected shape BEFORE we feed it to LangGraph.
// This prevents "mystery crashes" from corrupted checkpoints.

export const ChunkSchema = z.object({
  index: z.number().int().min(0),
  content: z.string().min(1),
  tokenCount: z.number().int().min(0),
  embedding: z.array(z.number()).optional(),
});

export const WorkflowErrorSchema = z.object({
  node: z.string(),
  chunkIndex: z.number().int().optional(),
  message: z.string(),
  timestamp: z.string(),
  retryable: z.boolean(),
});

export const BookAnalysisStateSchema = z.object({
  // Identity
  workflowId: z.string().uuid(),
  userId: z.string().min(1),
  bookId: z.string().uuid(),

  // Input
  title: z.string().min(1),
  rawText: z.string(),

  // Chunk Pipeline
  chunks: z.array(ChunkSchema),
  currentChunkIndex: z.number().int().min(0),
  currentChunk: ChunkSchema.nullable(),

  // Agent Results
  themes: z.array(z.any()),
  summaries: z.array(z.any()),
  quotes: z.array(z.any()),
  philosophy: z.array(z.any()),
  emotions: z.array(z.any()),

  // Embeddings
  embeddings: z.array(z.array(z.number())),

  // Aggregated Result (nullable — only set after aggregateResults completes)
  aggregatedResult: z.any().nullable(),

  // Workflow Control
  workflowStatus: z.enum(["idle", "running", "completed", "failed"]),
  currentNode: z.string(),
  retryCount: z.number().int().min(0),
  errors: z.array(WorkflowErrorSchema),
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. TypeScript Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface BookAnalysisStateType {
  workflowId: string;
  userId: string;
  bookId: string;
  title: string;
  rawText: string;
  chunks: Chunk[];
  currentChunkIndex: number;
  currentChunk: Chunk | null;
  themes: ThemeResult[];
  summaries: SummaryResult[];
  quotes: QuoteResult[];
  philosophy: PhilosophyResult[];
  emotions: EmotionResult[];
  embeddings: number[][];
  aggregatedResult: AggregatedAnalysis | null;
  workflowStatus: WorkflowStatus;
  currentNode: string;
  retryCount: number;
  errors: WorkflowError[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. State Factory — Create Initial State
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateStateParams {
  workflowId: string;
  userId: string;
  bookId: string;
  title: string;
  rawText: string;
}

/**
 * Creates the initial state for a new Workflow run.
 * All collections are empty — they will be populated by Nodes.
 */
export function createInitialState(params: CreateStateParams): BookAnalysisStateType {
  return {
    workflowId: params.workflowId,
    userId: params.userId,
    bookId: params.bookId,
    title: params.title,
    rawText: params.rawText,

    // Chunk Pipeline — empty, populated by splitBook
    chunks: [],
    currentChunkIndex: 0,
    currentChunk: null,

    // Agent Results — empty, populated by each agent node
    themes: [],
    summaries: [],
    quotes: [],
    philosophy: [],
    emotions: [],

    // Embeddings — populated by embeddingChunks
    embeddings: [],

    // Aggregated Result — populated by aggregateResults
    aggregatedResult: null,

    // Workflow Control
    workflowStatus: "idle",
    currentNode: "",
    retryCount: 0,
    errors: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Serialization — JSONB ↔ State
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serializes state to a plain object for PostgreSQL JSONB storage.
 * The state is already flat and serializable by design — no special
 * transformation needed beyond JSON.stringify().
 */
export function serializeState(state: BookAnalysisStateType): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Deserializes state from PostgreSQL JSONB.
 * Validates the shape with Zod before returning.
 * Throws if the data is corrupted — this is intentional:
 * we want to KNOW if a checkpoint is bad, not silently propagate errors.
 */
export function deserializeState(raw: unknown): BookAnalysisStateType {
  const parsed = BookAnalysisStateSchema.parse(raw);
  return parsed as BookAnalysisStateType;
}

/**
 * Safely attempts deserialization. Returns null instead of throwing.
 * Used for probing: "is this checkpoint still valid?"
 */
export function tryDeserializeState(raw: unknown): BookAnalysisStateType | null {
  const result = BookAnalysisStateSchema.safeParse(raw);
  if (result.success) {
    return result.data as BookAnalysisStateType;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. State Validation
// ═══════════════════════════════════════════════════════════════════════════

export interface StateValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

/**
 * Validates that a state object conforms to the expected schema.
 * Used before checkpoint save and after checkpoint load.
 */
export function validateState(state: unknown): StateValidationResult {
  const result = BookAnalysisStateSchema.safeParse(state);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. State Transition Map
// ═══════════════════════════════════════════════════════════════════════════
//
// Documents which fields each Node is expected to modify.
// Used for:
//   - Debugging: "which node modified field X?"
//   - Recovery: "do I need to re-run this node?"
//   - Testing: "did this node touch fields it shouldn't?"

export const NodeStateTransitions: Record<string, (keyof BookAnalysisStateType)[]> = {
  loadBook: ["rawText", "title", "currentNode", "workflowStatus"],
  splitBook: ["chunks", "currentNode"],
  embeddingChunks: ["embeddings", "currentNode"],
  themeAnalyzer: ["themes", "currentChunkIndex", "currentNode"],
  summaryAnalyzer: ["summaries", "currentChunkIndex", "currentNode"],
  quoteExtractor: ["quotes", "currentChunkIndex", "currentNode"],
  philosophyAnalyzer: ["philosophy", "currentNode"],
  emotionAnalyzer: ["emotions", "currentChunkIndex", "currentNode"],
  aggregateResults: ["currentNode"],
  saveAnalysis: ["workflowStatus", "currentNode"],
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. Progress Calculation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates workflow progress as a 0-1 float.
 * Used by the Progress API to show real-time status to mobile/web clients.
 */
export function calculateProgress(state: BookAnalysisStateType): number {
  const totalNodes = Object.keys(NodeStateTransitions).length; // 10
  const completedNodes = Object.entries(NodeStateTransitions).filter(
    ([node, fields]) => {
      // A node is "complete" if its key output fields are non-empty
      // (for collection fields) or non-default (for scalar fields)
      for (const field of fields) {
        const value = state[field];
        if (Array.isArray(value) && value.length > 0) continue;
        if (typeof value === "string" && value !== "" && field !== "currentNode") continue;
        if (field === "currentNode" && value === node) return true;
        return false;
      }
      return true;
    }
  ).length;

  // Add fractional progress for chunk processing
  const chunkProgress =
    state.chunks.length > 0
      ? state.currentChunkIndex / state.chunks.length
      : 0;

  // Weighted: 70% node completion, 30% chunk progress
  return Math.min(1, completedNodes / totalNodes * 0.7 + chunkProgress * 0.3);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. LangGraph Annotation (drives the StateGraph)
// ═══════════════════════════════════════════════════════════════════════════
//
// IMPORTANT — Why separate Annotation from TypeScript interface?
//
// The Annotation defines HOW state fields merge across nodes:
//   - Scalar fields (workflowStatus, currentNode): REPLACE on update
//   - Collection fields (themes, quotes): APPEND on update
//
// If we used only TypeScript types, every node would need to manually
// merge old + new arrays. With Annotations, LangGraph does it automatically:
//
//   Node A returns: { themes: [theme1] }
//   Node B returns: { themes: [theme2] }
//   Merged state:   { themes: [theme1, theme2] }  ← automatic!

export const BookAnalysisState = Annotation.Root({
  // ── Identity ──
  workflowId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  bookId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // ── Input ──
  title: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  rawText: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // ── Chunk Pipeline ──
  chunks: Annotation<Chunk[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  currentChunkIndex: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  currentChunk: Annotation<Chunk | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ── Agent Results (APPEND — critical for Map phase) ──
  // Each agent processes ONE chunk and appends ONE result.
  // Across a 100-chunk book, themeAnalyzer runs 100 times —
  // each run appends 1 ThemeResult to the array.
  themes: Annotation<ThemeResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  summaries: Annotation<SummaryResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  quotes: Annotation<QuoteResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  philosophy: Annotation<PhilosophyResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  emotions: Annotation<EmotionResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // ── Embeddings ──
  embeddings: Annotation<number[][]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // ── Aggregated Result ──
  aggregatedResult: Annotation<AggregatedAnalysis | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ── Workflow Control ──
  workflowStatus: Annotation<WorkflowStatus>({
    reducer: (_, next) => next,
    default: () => "idle",
  }),
  currentNode: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  retryCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  errors: Annotation<WorkflowError[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});
