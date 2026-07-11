// PERSON A — POST /api/agent/confirm
// Now delegates to Person B's guardrailBridge instead of orchestrator's internal resolver
import { Router } from 'express';
import { z } from 'zod';
import { guardrailBridge } from '../tools/guardrails.js';

const router = Router();

const ConfirmSchema = z.object({
  runId: z.string().uuid(),
  decision: z.enum(['authorize', 'cancel']),
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

export default router;
