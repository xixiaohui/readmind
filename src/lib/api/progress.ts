// ---------------------------------------------------------------------------
// Workflow Progress Event System
// ---------------------------------------------------------------------------
// Simple in-memory pub/sub for real-time workflow progress events.
//
// Architecture:
//   Workflow Node → progressEmitter.emit(event)
//                         │
//                         ▼
//   SSE Route ← subscribe(workflowId) → ReadableStream
//                         │
//                         ▼
//   Client (Web / iOS / Android) receives SSE events
//
// In production, replace this with Redis Pub/Sub for multi-instance support.
// The interface is the same — just swap the implementation.
// ---------------------------------------------------------------------------

import type { ProgressEvent } from "@/lib/workflow/context";

// ═══════════════════════════════════════════════════════════════════════════
// Event Emitter
// ═══════════════════════════════════════════════════════════════════════════

type Listener = (event: ProgressEvent) => void;

class ProgressEventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  /**
   * Subscribe to progress events for a specific workflow.
   * Returns an unsubscribe function.
   */
  subscribe(workflowId: string, listener: Listener): () => void {
    if (!this.listeners.has(workflowId)) {
      this.listeners.set(workflowId, new Set());
    }
    this.listeners.get(workflowId)!.add(listener);

    return () => {
      this.listeners.get(workflowId)?.delete(listener);
    };
  }

  /**
   * Emit a progress event to all subscribers of a workflow.
   */
  emit(event: ProgressEvent): void {
    const subs = this.listeners.get(event.workflowId);
    if (!subs) return;

    for (const listener of subs) {
      try {
        listener(event);
      } catch {
        // Don't let one failed listener break others
      }
    }
  }

  /**
   * Clean up all listeners for a workflow (called when workflow completes).
   */
  cleanup(workflowId: string): void {
    this.listeners.delete(workflowId);
  }
}

// Global singleton
export const progressEmitter = new ProgressEventEmitter();

// ═══════════════════════════════════════════════════════════════════════════
// SSE Encoder
// ═══════════════════════════════════════════════════════════════════════════

const encoder = new TextEncoder();

/**
 * Converts a ProgressEvent to SSE format.
 * SSE format:
 *   event: <type>\n
 *   data: <json>\n\n
 */
function toSSE(event: ProgressEvent): Uint8Array {
  const data = JSON.stringify(event);
  return encoder.encode(`event: ${event.status}\ndata: ${data}\n\n`);
}

/**
 * Creates a ReadableStream that emits SSE progress events
 * for a given workflow. Used directly by the SSE route handler.
 */
export function createProgressStream(workflowId: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // Send initial connection event
      const initEvent: ProgressEvent = {
        workflowId,
        node: "connect",
        chunkIndex: 0,
        totalChunks: 0,
        status: "started",
        message: "SSE connection established",
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(toSSE(initEvent));

      // Subscribe to progress events
      const unsubscribe = progressEmitter.subscribe(workflowId, (event) => {
        controller.enqueue(toSSE(event));

        // Close stream when workflow completes or errors
        if (event.status === "completed" || event.status === "error") {
          controller.close();
          unsubscribe();
          progressEmitter.cleanup(workflowId);
        }
      });

      // Handle client disconnect
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
          unsubscribe();
        }
      }, 15_000); // 15s keepalive
    },
  });
}
