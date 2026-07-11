// PERSON A — GET /api/agent/stream/:runId (SSE)
import { Router } from 'express';
import { registerClient, broadcastAndClose } from '../services/sseManager.js';
import { getRunEventsSince, getRunById } from '../services/database.js';

const router = Router();

// Terminal run statuses — if the run is already done, close immediately after replay
const TERMINAL_RUN_STATUSES = new Set(['COMPLETE', 'FAILED', 'CANCELLED']);

router.get('/stream/:runId', async (req, res) => {
  const { runId } = req.params;
  const lastEventId = req.headers['last-event-id'] as string | undefined;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial comment to establish connection
  res.write(': connected\n\n');

  try {
    // Replay missed events if client reconnects
    if (lastEventId) {
      const events = await getRunEventsSince(runId, lastEventId);
      for (const ev of events) {
        res.write(`id: ${ev.id}\n`);
        res.write(`event: ${ev.type}\n`);
        res.write(`data: ${JSON.stringify({
          type: ev.type,
          message: ev.message,
          timestamp: ev.created_at.toISOString(),
          payload: ev.payload,
        })}\n\n`);
      }
    } else {
      // Send all existing events for this run
      const events = await getRunEventsSince(runId);
      for (const ev of events) {
        res.write(`id: ${ev.id}\n`);
        res.write(`event: ${ev.type}\n`);
        res.write(`data: ${JSON.stringify({
          type: ev.type,
          message: ev.message,
          timestamp: ev.created_at.toISOString(),
          payload: ev.payload,
        })}\n\n`);
      }
    }

    // Check if the run is already in a terminal state
    const run = await getRunById(runId);
    if (run && TERMINAL_RUN_STATUSES.has(run.status)) {
      // Run already finished — send close signal and end
      res.write(`event: close\ndata: {"reason":"${run.status.toLowerCase()}"}\n\n`);
      setTimeout(() => {
        try { res.end(); } catch { /* already closed */ }
      }, 500);
      return;
    }

    // Register this client for live broadcasts
    registerClient(runId, res);
  } catch (err) {
    console.error(`SSE stream error for run ${runId}:`, err);
    // Send error event and close
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream error' })}\n\n`);
    res.end();
  }
});

export default router;
