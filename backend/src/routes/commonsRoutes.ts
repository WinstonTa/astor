// PERSON A — GET /api/commons, PUT /api/commons/:factId
import { Router } from 'express';
import { z } from 'zod';
import { getCommonsFacts, updateCommonsFact } from '../services/database.js';

const router = Router();

// GET /api/commons — list user's shared preferences
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter required' });
    }

    const facts = await getCommonsFacts(userId);
    res.json({ facts });
  } catch (err: any) {
    console.error('GET /api/commons error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/commons/:factId — edit a shared preference
const UpdateFactSchema = z.object({
  fact: z.string().min(1).max(2000),
});

router.put('/:factId', async (req, res) => {
  try {
    const parsed = UpdateFactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const updated = await updateCommonsFact(req.params.factId, parsed.data.fact);
    if (!updated) {
      return res.status(404).json({ error: 'Fact not found' });
    }

    res.json({ fact: updated });
  } catch (err: any) {
    console.error('PUT /api/commons/:factId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
