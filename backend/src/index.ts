// PERSON A — Server bootstrap
import 'dotenv/config';
import express from 'express';
import runRoutes from './routes/runRoutes.js';
import streamRoutes from './routes/streamRoutes.js';
import confirmRoutes from './routes/confirmRoutes.js';
import commonsRoutes from './routes/commonsRoutes.js';
import { startHeartbeat, stopHeartbeat } from './services/sseManager.js';
import { getAllAgents } from './services/database.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Agent registry ────────────────────────────────────────────────────────
app.get('/api/agents', async (_req, res) => {
  try {
    const agents = await getAllAgents();
    res.json({ agents });
  } catch (err: any) {
    console.error('GET /api/agents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/agent', runRoutes);
app.use('/api/agent', streamRoutes);
app.use('/api/agent', confirmRoutes);
app.use('/api/commons', commonsRoutes);

// ── Start ─────────────────────────────────────────────────────────────────
startHeartbeat();

const server = app.listen(PORT, () => {
  console.log(`Astor backend listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  stopHeartbeat();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  stopHeartbeat();
  server.close(() => process.exit(0));
});
