// ---------------------------------------------------------------------------
// ReadMeet Insight — Core Domain Types
// ---------------------------------------------------------------------------
// These types are shared across the entire backend: workflow, agents, API, DB.
// They encode the architecture decisions documented in ARCHITECTURE.md.
// ---------------------------------------------------------------------------

// ─── Identity ───────────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateTime = string;

// ─── Workflow Control ───────────────────────────────────────────────────────

export type WorkflowStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

// ─── Chunks ─────────────────────────────────────────────────────────────────

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
  /** pgvector embedding — populated after embeddingChunks node */
  embedding?: number[];
}

// ─── Analysis Results (per Agent) ───────────────────────────────────────────

export interface ThemeResult {
  chunkIndex: number;
  themes: {
    name: string;
    description: string;
    weight: number; // 0-1 importance score
    keywords: string[];
  }[];
}

export interface SummaryResult {
  chunkIndex: number;
  summary: string;
  keyPoints: string[];
  readingLevel: "beginner" | "intermediate" | "advanced";
}

export interface QuoteResult {
  chunkIndex: number;
  quotes: {
    text: string;
    context: string;
    category: "insight" | "wisdom" | "emotional" | "philosophical" | "practical";
    score: number; // 0-1 quality score
  }[];
}

export interface PhilosophyResult {
  chunkIndex: number;
  frameworks: {
    name: string;
    description: string;
    confidence: number; // 0-1
    relatedThemes: string[]; // links to ThemeResult themes
  }[];
  argumentStructure: {
    claim: string;
    evidence: string[];
    reasoning: string;
  }[];
}

export interface EmotionResult {
  chunkIndex: number;
  emotions: {
    primary: string;
    secondary: string[];
    intensity: number; // 0-1
    valence: "positive" | "negative" | "neutral" | "mixed";
  }[];
  overallTone: string;
  toneShiftPoints: { chunkIndex: number; description: string }[];
}

// ─── Workflow Error ─────────────────────────────────────────────────────────

export interface WorkflowError {
  node: string;
  chunkIndex?: number;
  message: string;
  timestamp: ISODateTime;
  retryable: boolean;
}

// ─── Aggregated Analysis (final output) ─────────────────────────────────────

export interface AggregatedAnalysis {
  bookId: UUID;
  workflowId: UUID;
  title: string;
  themes: {
    name: string;
    description: string;
    weight: number;
    occurrences: number; // across how many chunks
  }[];
  summary: string; // full-book summary
  topQuotes: QuoteResult["quotes"]; // curated across all chunks
  philosophy: {
    primaryFrameworks: PhilosophyResult["frameworks"];
    argumentSummary: string;
  };
  emotions: {
    overallTone: string;
    emotionArc: { label: string; intensity: number }[];
    valenceDistribution: Record<string, number>;
  };
  metadata: {
    chunkCount: number;
    totalTokens: number;
    processingTimeMs: number;
    model: string;
  };
}
