// PERSON A — POST /api/agent/confirm and POST /api/agent/reply
// Now delegates to Person B's guardrailBridge instead of orchestrator's internal resolver
import { Router } from 'express';
import { z } from 'zod';
import { guardrailBridge } from '../tools/guardrails.js';
import { submitUserReply } from '../services/orchestrator.js';

const router = Router();

const ConfirmSchema = z.object({
  runId: z.string().uuid(),
  decision: z.enum(['authorize', 'cancel']),
});

const ReplySchema = z.object({
  runId: z.string().uuid(),
  reply: z.string().min(1),
});

router.post('/confirm', async (req, res) => {
  try {
    const parsed = ConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { runId, decision } = parsed.data;
    const resolved = guardrailBridge.resolveAuthorization(runId, decision);

    if (!resolved) {
      return res.status(404).json({ error: 'No pending guardrail for this run' });
    }

    res.json({ ok: true, decision });
  } catch (err: any) {
    console.error('POST /api/agent/confirm error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reply', async (req, res) => {
  try {
    const parsed = ReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { runId, reply } = parsed.data;
    const submitted = submitUserReply(runId, reply);

    if (!submitted) {
      return res.status(404).json({ error: 'No pending user input for this run' });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('POST /api/agent/reply error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
