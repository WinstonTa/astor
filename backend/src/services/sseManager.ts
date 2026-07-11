// PERSON A — SSE connection manager
// Registry keyed by runId, heartbeat every 25s, Last-Event-ID replay from run_events
import type { Response } from 'express';
import type { ITelemetryFrame } from '../contracts/streamContract.js';
import { getRunEventsSince } from './database.js';

// ── Connection registry ───────────────────────────────────────────────────
// runId → Set of active SSE responses
const connections = new Map<string, Set<Response>>();

// Track which connections are still writable (not closed/errored)
const brokenConnections = new WeakSet<Response>();

// ── Register / unregister ─────────────────────────────────────────────────
export function registerClient(runId: string, res: Response): void {
  if (!connections.has(runId)) {
    connections.set(runId, new Set());
  }
  connections.get(runId)!.add(res);

  // Track broken connections to avoid writing to them
  res.on('error', () => {
    brokenConnections.add(res);
  });

  // Clean up on disconnect
  res.on('close', () => {
    brokenConnections.delete(res);
    const set = connections.get(runId);
    if (set) {
      set.delete(res);
      if (set.size === 0) connections.delete(runId);
    }
  });
}

export function unregisterClient(runId: string, res: Response): void {
  const set = connections.get(runId);
  if (set) {
    set.delete(res);
    if (set.size === 0) connections.delete(runId);
  }
}

// ── Safe write helper ──────────────────────────────────────────────────────
function safeWrite(res: Response, data: string): boolean {
  if (brokenConnections.has(res) || res.writableEnded || res.destroyed) {
    return false;
  }
  try {
    return res.write(data);
  } catch {
    brokenConnections.add(res);
    return false;
  }
}

// ── Broadcast to all clients watching a run ───────────────────────────────
export function broadcast(runId: string, frame: ITelemetryFrame, eventId?: string): void {
  const set = connections.get(runId);
  if (!set || set.size === 0) return;

  const data = JSON.stringify(frame);
  for (const res of set) {
    if (eventId) safeWrite(res, `id: ${eventId}\n`);
    safeWrite(res, `event: ${frame.type}\n`);
    safeWrite(res, `data: ${data}\n\n`);
  }
}

// ── Close all connections for a run (after terminal state) ────────────────
const TERMINAL_STATES = new Set(['complete', 'failed', 'cancelled']);

/**
 * Send a terminal event and close all SSE connections for a run.
 * Called by the orchestrator after COMPLETE / FAILED / CANCELLED.
 */
export function broadcastAndClose(runId: string, frame: ITelemetryFrame, eventId?: string): void {
  const set = connections.get(runId);
  if (!set || set.size === 0) return;

  const data = JSON.stringify(frame);

  for (const res of set) {
    // Send the terminal event
    if (eventId) safeWrite(res, `id: ${eventId}\n`);
    safeWrite(res, `event: ${frame.type}\n`);
    safeWrite(res, `data: ${data}\n\n`);

    // Send a close signal so the client knows to disconnect
    safeWrite(res, `event: close\ndata: {"reason":"${frame.type}"}\n\n`);

    // End the response after a brief flush delay
    setTimeout(() => {
      try {
        if (!res.writableEnded) {
          res.end();
        }
      } catch {
        // already closed
      }
    }, 500);
  }

  // Clean up the registry
  connections.delete(runId);
}

// ── Replay missed events (Last-Event-ID support) ─────────────────────────
export async function replaySince(runId: string, res: Response, lastEventId: string): Promise<void> {
  const events = await getRunEventsSince(runId, lastEventId);
  for (const ev of events) {
    const frame: ITelemetryFrame = {
      type: ev.type as ITelemetryFrame['type'],
      message: ev.message,
      timestamp: ev.created_at.toISOString(),
      payload: ev.payload,
    };
    safeWrite(res, `id: ${ev.id}\n`);
    safeWrite(res, `event: ${frame.type}\n`);
    safeWrite(res, `data: ${JSON.stringify(frame)}\n\n`);
  }
}

// ── Heartbeat (keep-alive every 25s) ─────────────────────────────────────
const HEARTBEAT_MS = 25_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const [runId, set] of connections) {
      for (const res of set) {
        if (!safeWrite(res, `: heartbeat\n\n`)) {
          // Connection is broken — clean it up
          unregisterClient(runId, res);
        }
      }
    }
  }, HEARTBEAT_MS);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── Stats (for health/debug) ─────────────────────────────────────────────
export function getActiveRunCount(): number {
  return connections.size;
}

export function getClientCount(runId: string): number {
  return connections.get(runId)?.size ?? 0;
}
