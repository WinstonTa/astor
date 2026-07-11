// PERSON A — Server bootstrap
import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes will be mounted here (A2)
// app.use('/api/agent', runRoutes);
// app.use('/api/agent', streamRoutes);
// app.use('/api/agent', confirmRoutes);
// app.use('/api/commons', commonsRoutes);

app.listen(PORT, () => {
  console.log(`Astor backend listening on port ${PORT}`);
});
