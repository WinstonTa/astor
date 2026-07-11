// PERSON A — Post-run episodic memory writer
// Summarization → embedding → episodic_memories insert
import OpenAI from 'openai';
import { insertEpisodicMemory } from './database.js';

const client = new OpenAI({
  baseURL: 'https://inference.do-ai.run/v1/',
  apiKey: process.env.DIGITAL_OCEAN_MODEL_ACCESS_KEY ?? '',
});

/**
 * After a run completes, summarize what happened and store it as an episodic memory.
 * The summary is embedded via Anthropic and stored in pgvector for future semantic recall.
 */
export async function writeMemory(params: {
  userId: string;
  agentId: string;
  runId: string;
  userPrompt: string;
  assistantResponse: string;
}): Promise<void> {
  const { userId, agentId, runId, userPrompt, assistantResponse } = params;

  // ── 1. Summarize the interaction ─────────────────────────────────────
  const summary = await summarize(userPrompt, assistantResponse);

  // ── 2. Embed the summary ─────────────────────────────────────────────
  const embedding = await embed(summary);

  // ── 3. Store in episodic_memories ────────────────────────────────────
  await insertEpisodicMemory(userId, agentId, summary, embedding, runId);
}

// ── Summarization via DigitalOcean Inference ──────────────────────────────
async function summarize(userPrompt: string, assistantResponse: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: 'deepseek-v4-pro',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Summarize the following interaction in 1-2 concise sentences. Focus on what was accomplished, what the user wanted, and any key decisions or outcomes. This summary will be used as episodic memory for future reference.\n\nUser request: ${userPrompt}\n\nAgent response: ${assistantResponse}`,
      },
    ],
  });

  return res.choices[0]?.message?.content ?? '';
}

// ── Embedding via Anthropic ──────────────────────────────────────────────
// Note: Anthropic doesn't have a native embedding API yet.
// This is a placeholder that generates a mock embedding.
// In production, swap this for OpenAI embeddings or a dedicated embedding service.
async function embed(text: string): Promise<number[]> {
  // TODO: Replace with real embedding API when available
  // For now, generate a deterministic pseudo-embedding from the text hash
  const hash = simpleHash(text);
  const vec = new Array(1536).fill(0);
  for (let i = 0; i < 1536; i++) {
    vec[i] = Math.sin(hash * (i + 1)) * 0.5;
  }
  // Normalize to unit vector
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}
