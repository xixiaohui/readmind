// ---------------------------------------------------------------------------
// Database Schema — ReadMeet Insight
// ---------------------------------------------------------------------------
// All table definitions are exported from here.
// Drizzle Kit reads this file to generate migrations.
//
// Tables (per dev.md §6 + ARCHITECTURE.md §7):
//   books, book_chunks, workflow_runs, workflow_steps,
//   book_analysis, embeddings, quotes, themes, user_library
// ---------------------------------------------------------------------------

export { books } from "./books";
export { bookChunks } from "./chunks";
export { workflowRuns } from "./workflows";
export { workflowSteps } from "./steps";
export { bookAnalysis } from "./analysis";
export { embeddings } from "./embeddings";
export { quotes } from "./quotes";
export { themes } from "./themes";
export { userLibrary } from "./library";
export { users } from "./users";
export { paymentOrders } from "./payments";
