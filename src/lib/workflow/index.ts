// ---------------------------------------------------------------------------
// Workflow Module — Public API
// ---------------------------------------------------------------------------
// This is the single entry point for the entire AI Workflow system.
// External consumers (API routes, tests, CLI) should only import from here.
// ---------------------------------------------------------------------------

// State
export {
  createInitialState,
  serializeState,
  deserializeState,
  tryDeserializeState,
  validateState,
  calculateProgress,
  BookAnalysisState,
  NodeStateTransitions,
} from "./state";
export type {
  BookAnalysisStateType,
  CreateStateParams,
  StateValidationResult,
} from "./state";

// Graph
export { createBookAnalysisGraph, bookAnalysisGraph } from "./graph";
export type { CreateGraphOptions, BookAnalysisGraph } from "./graph";

// Checkpoint
export {
  saveCheckpoint,
  loadCheckpoint,
  getStepHistory,
  markWorkflowFailed,
} from "./checkpoint";
export type {
  SaveCheckpointParams,
  LoadCheckpointResult,
  StepHistoryEntry,
  MarkFailedParams,
} from "./checkpoint";

// Checkpointer (LangGraph integration)
export { PostgresCheckpointer } from "./postgresCheckpointer";

// Runner
export { runBookAnalysisWorkflow } from "./runner";
export type { RunWorkflowParams, RunWorkflowResult } from "./runner";

// Context
export { WorkflowContext } from "./context";
export type {
  LLMClient,
  LLMMessage,
  ProgressEvent,
  ProgressEmitter,
  WorkflowContextOptions,
} from "./context";

// Nodes
export * from "./nodes";
