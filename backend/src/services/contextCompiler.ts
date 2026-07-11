// PERSON A — Prompt assembly
// Merges base agent script + Commons facts + episodic memories + user prompt
import { searchCommonsFacts, searchEpisodicMemories, getAgentBySlug } from './database.js';

interface CompiledContext {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Build the full LLM context for a run.
 *
 * 1. Load the agent's base system prompt (from tool_manifest or a default).
 * 2. Semantic-search the user's Information Commons for relevant shared prefs.
 * 3. Semantic-search the user's episodic memory for this specific agent.
 * 4. Assemble everything into system + user messages.
 */
export async function compileContext(params: {
  userId: string;
  agentId: string;
  agentSlug: string;
  userPrompt: string;
  queryEmbedding?: number[]; // embedding of the user prompt for semantic recall
}): Promise<CompiledContext> {
  const { userId, agentId, agentSlug, userPrompt, queryEmbedding } = params;

  // ── 1. Agent base prompt ──────────────────────────────────────────────
  const agent = await getAgentBySlug(agentSlug);
  const basePrompt = buildAgentSystemPrompt(agent);

  // ── 2. Information Commons (cross-agent shared context) ───────────────
  let commonsSection = '';
  if (queryEmbedding) {
    const facts = await searchCommonsFacts(userId, queryEmbedding, 8);
    if (facts.length > 0) {
      const factLines = facts.map((f: any) => `- ${f.fact}`).join('\n');
      commonsSection = `\n\n## User Preferences (Information Commons)\n${factLines}`;
    }
  }

  // ── 3. Episodic memory (agent-specific, strict isolation) ────────────
  let memorySection = '';
  if (queryEmbedding) {
    const memories = await searchEpisodicMemories(userId, agentId, queryEmbedding, 5);
    if (memories.length > 0) {
      const memLines = memories.map((m: any) => `- ${m.summary}`).join('\n');
      memorySection = `\n\n## Relevant Past Experiences\n${memLines}`;
    }
  }

  // ── 4. Assemble ───────────────────────────────────────────────────────
  const systemPrompt = `${basePrompt}${commonsSection}${memorySection}`;

  return { systemPrompt, userPrompt };
}

// ── Agent system prompt builder ───────────────────────────────────────────
function buildAgentSystemPrompt(agent: any): string {
  if (!agent) {
    return 'You are a helpful AI assistant. You have access to browser automation tools to complete tasks on behalf of the user.';
  }

  const tools = agent.tool_manifest?.tools ?? [];
  const toolList = tools.length > 0
    ? `You have access to these tools: ${tools.join(', ')}.`
    : '';

  return `You are ${agent.name}, an AI agent specialized in: ${agent.purpose}.
${toolList}

When you need to perform browser actions, use the browser_search and browser_book tools.
Always explain what you are doing step by step.
Before performing any transaction that involves spending money, you MUST request user confirmation — do not finalize purchases without explicit authorization.`;
}
