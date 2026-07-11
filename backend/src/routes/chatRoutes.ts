// POST /api/chat — unified chat with LLM router
import { Router } from 'express';
import { z } from 'zod';
import { routeAgent } from '../services/router.js';
import { getAgentBySlug, createRun } from '../services/database.js';
import { startRun } from '../services/orchestrator.js';

const router = Router();

const ChatSchema = z.object({
  userId: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

router.post('/chat', async (req, res) => {
  try {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { userId, message } = parsed.data;

    // Route to the best agent
    const decision = await routeAgent(userId, message);

    if (!decision.agentSlug || decision.confidence < 0.3) {
      return res.status(422).json({
        error: 'Could not determine the right agent for your request. Please try being more specific.',
        confidence: decision.confidence,
      });
    }

    // Look up the agent
    const agent = await getAgentBySlug(decision.agentSlug);
    if (!agent) {
      return res.status(422).json({
        error: `Routed to unknown agent "${decision.agentSlug}". Please try again.`,
      });
    }

    // Create a run with the routed agent
    const run = await createRun(userId, agent.id, message);

    // Fire-and-forget: orchestrator runs asynchronously, streams via SSE
    startRun(run.id).catch((err) => {
      console.error(`Orchestrator error for run ${run.id}:`, err);
    });

    res.status(201).json({
      runId: run.id,
      agent: {
        id: agent.slug,
        dbId: agent.id,
        slug: agent.slug,
        name: agent.name,
        purpose: agent.purpose,
      },
      confidence: decision.confidence,
    });
  } catch (err: any) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
