// Router service — LLM-based agent selection
// Takes a user message and determines which agent should handle it.
import OpenAI from 'openai';
import { getAllAgents } from './database.js';

const client = new OpenAI({
  baseURL: 'https://inference.do-ai.run/v1/',
  apiKey: process.env.DIGITAL_OCEAN_MODEL_ACCESS_KEY ?? '',
});

const MODEL = process.env.LLM_MODEL ?? 'deepseek-v4-pro';

interface RouterDecision {
  agentSlug: string;
  confidence: number;
}

/**
 * Build the router system prompt from the current agent roster.
 * Lightweight — only slug, name, and purpose per agent.
 */
async function buildRouterPrompt(): Promise<string> {
  const agents = await getAllAgents();

  const agentList = agents
    .map((a) => `- **${a.slug}**: ${a.name} — ${a.purpose}`)
    .join('\n');

  return `You are an agent router. Given the user's message, pick the single best agent to handle it.

Available agents:
${agentList}

Respond with ONLY a JSON object (no markdown, no explanation):
{"agent": "<slug>", "confidence": <0.0 to 1.0>}

Rules:
- Pick the agent whose purpose best matches the user's intent
- confidence 0.8+ = clear match, 0.5-0.8 = probable match, <0.5 = uncertain
- If no agent is a good match, use the closest one with low confidence
- Never invent slugs not listed above`;
}

/**
 * Route a user message to the best agent.
 * Returns the agent slug and confidence score.
 */
export async function routeAgent(userId: string, message: string): Promise<RouterDecision> {
  const systemPrompt = await buildRouterPrompt();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 200,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';

  try {
    // Strip markdown code fences if present
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      agentSlug: parsed.agent ?? '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch {
    console.error('[router] Failed to parse LLM response:', content);
    return { agentSlug: '', confidence: 0 };
  }
}
