// PERSON A — POST /api/agent/run
import { Router } from 'express';
import { z } from 'zod';
import { createRun } from '../services/database.js';
import { startRun } from '../services/orchestrator.js';

const router = Router();

const RunSchema = z.object({
  userId: z.string().uuid(),
  agentId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

router.post('/run', async (req, res) => {
  try {
    const parsed = RunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { userId, agentId, prompt } = parsed.data;
    const run = await createRun(userId, agentId, prompt);

    // Fire-and-forget: orchestrator runs asynchronously, streams via SSE
    startRun(run.id).catch((err) => {
      console.error(`Orchestrator error for run ${run.id}:`, err);
    });

    res.status(201).json({ runId: run.id });
  } catch (err: any) {
    console.error('POST /api/agent/run error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
