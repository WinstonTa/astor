// PERSON A — GET /api/agent/stream/:runId (SSE)
import { Router } from 'express';
import { registerClient, replaySince } from '../services/sseManager.js';
import { getRunEventsSince } from '../services/database.js';

const router = Router();

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

  // Replay missed events if client reconnects
  if (lastEventId) {
    await replaySince(runId, res, lastEventId);
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

  // Register this client for live broadcasts
  registerClient(runId, res);
});

export default router;
