// PERSON A — SSE connection manager
// Registry keyed by runId, heartbeat every 25s, Last-Event-ID replay from run_events
import type { Response } from 'express';
import type { ITelemetryFrame } from '../contracts/streamContract.js';
import { getRunEventsSince } from './database.js';

// ── Connection registry ───────────────────────────────────────────────────
// runId → Set of active SSE responses
const connections = new Map<string, Set<Response>>();

// ── Register / unregister ─────────────────────────────────────────────────
export function registerClient(runId: string, res: Response): void {
  if (!connections.has(runId)) {
    connections.set(runId, new Set());
  }
  connections.get(runId)!.add(res);

  // Clean up on disconnect
  res.on('close', () => {
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

// ── Broadcast to all clients watching a run ───────────────────────────────
export function broadcast(runId: string, frame: ITelemetryFrame, eventId?: string): void {
  const set = connections.get(runId);
  if (!set || set.size === 0) return;

  const data = JSON.stringify(frame);
  for (const res of set) {
    if (eventId) res.write(`id: ${eventId}\n`);
    res.write(`event: ${frame.type}\n`);
    res.write(`data: ${data}\n\n`);
  }
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
    res.write(`id: ${ev.id}\n`);
    res.write(`event: ${frame.type}\n`);
    res.write(`data: ${JSON.stringify(frame)}\n\n`);
  }
}

// ── Heartbeat (keep-alive every 25s) ─────────────────────────────────────
const HEARTBEAT_MS = 25_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const [, set] of connections) {
      for (const res of set) {
        res.write(`: heartbeat\n\n`);
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
