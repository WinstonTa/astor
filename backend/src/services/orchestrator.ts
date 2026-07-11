// PERSON A — Run lifecycle state machine
// QUEUED → HYDRATING → THINKING → EXECUTING_TOOL → AWAITING_CONFIRMATION → FINALIZING → COMPLETE | FAILED | CANCELLED
import type { ITelemetryFrame } from '../contracts/streamContract.js';
import type { IBrowserToolInvocation } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { compileContext } from './contextCompiler.js';
import { think, continueWithToolResult, type LLMDecision } from './llmClient.js';
import { broadcast } from './sseManager.js';
import { writeMemory } from './memoryWriter.js';
import {
  getRunById,
  updateRunStatus,
  insertRunEvent,
  getAgentById,
} from './database.js';
import { getToolsForAgent } from './toolRegistry.js';
// Day 5 handshake: swapped from mockToolExecutor → Person B's real Browserbase runtime
import { executeBrowserTask } from '../tools/browserCore.js';

type RunStatus =
  | 'QUEUED' | 'HYDRATING' | 'THINKING' | 'EXECUTING_TOOL'
  | 'AWAITING_CONFIRMATION' | 'FINALIZING'
  | 'COMPLETE' | 'FAILED' | 'CANCELLED';

// ── Active run tracking ───────────────────────────────────────────────────
const activeRuns = new Map<string, { abort: () => void }>();

// ── Tool-to-URL mapping for browser automation ────────────────────────────
const TOOL_TARGETS: Record<string, string> = {
  search_hotels: 'https://www.expedia.com',
  book_hotel: 'https://www.expedia.com',
};

/**
 * Kick off a run asynchronously. Returns immediately; the run streams via SSE.
 */
export async function startRun(runId: string): Promise<void> {
  const abortController = { aborted: false };
  activeRuns.set(runId, { abort: () => { abortController.aborted = true; } });

  try {
    const run = await getRunById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    const agent = await getAgentById(run.agent_id);
    if (!agent) throw new Error(`Agent ${run.agent_id} not found`);

    const hooks = createRunHooks(runId);
    const tools = getToolsForAgent(agent.slug);

    // ── HYDRATING ────────────────────────────────────────────────────
    await transition(runId, 'HYDRATING', 'Hydrating context from Information Commons and episodic memory...', hooks);
    if (abortController.aborted) return await cancel(runId, hooks);

    const context = await compileContext({
      userId: run.user_id,
      agentId: run.agent_id,
      agentSlug: agent.slug,
      userPrompt: run.prompt,
    });

    // ── THINKING (first LLM turn) ───────────────────────────────────
    await transition(runId, 'THINKING', 'Asking the AI agent to plan...', hooks);
    if (abortController.aborted) return await cancel(runId, hooks);

    const messages: any[] = [{ role: 'user', content: run.prompt }];
    let decision = await think({ systemPrompt: context.systemPrompt, messages, tools });

    // ── Tool-calling loop ──────────────────────────────────────────
    while (decision.type === 'tool_call') {
      if (abortController.aborted) return await cancel(runId, hooks);

      // ── EXECUTING_TOOL ───────────────────────────────────────────
      await transition(runId, 'EXECUTING_TOOL', `Executing tool: ${decision.toolName}...`, hooks);

      // Map LLM tool call to Person B's IBrowserToolInvocation
      const invocation: IBrowserToolInvocation = {
        runId,
        targetUrl: TOOL_TARGETS[decision.toolName!] ?? 'https://www.expedia.com',
        browserbaseContextId: '',
        searchParameters: extractSearchParameters(decision.toolInput),
      };

      // Person B's executeBrowserTask handles guardrails internally:
      // expediaMacro.ts calls requestAuthorization() which emits action_required
      // and waits for resolveAuthorization() via POST /api/agent/confirm
      const result = await executeBrowserTask(invocation, hooks);

      if (result.status === 'FAILED') {
        return await fail(runId, result.errorMessage ?? 'Tool execution failed.', hooks);
      }

      // ── Continue LLM loop with tool result ───────────────────────
      await transition(runId, 'THINKING', 'Processing results...', hooks);
      if (abortController.aborted) return await cancel(runId, hooks);

      decision = await continueWithToolResult({
        systemPrompt: context.systemPrompt,
        messages,
        toolName: decision.toolName!,
        toolResult: result,
        tools,
      });
    }

    // ── FINALIZING ──────────────────────────────────────────────────
    await transition(runId, 'FINALIZING', 'Saving episodic memory...', hooks);

    await writeMemory({
      userId: run.user_id,
      agentId: run.agent_id,
      runId,
      userPrompt: run.prompt,
      assistantResponse: decision.text ?? '',
    });

    // ── COMPLETE ────────────────────────────────────────────────────
    await transition(runId, 'COMPLETE', decision.text ?? 'Task completed successfully.', hooks);

  } catch (err: any) {
    console.error(`Run ${runId} failed:`, err);
    const hooks = createRunHooks(runId);
    await fail(runId, err.message ?? 'Unknown error', hooks);
  } finally {
    activeRuns.delete(runId);
  }
}

/**
 * Cancel an active run.
 */
export function cancelRun(runId: string): boolean {
  const entry = activeRuns.get(runId);
  if (!entry) return false;
  entry.abort();
  return true;
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function transition(
  runId: string,
  status: RunStatus,
  message: string,
  hooks: IRunHooks,
  extra?: { guardrail_payload?: unknown },
) {
  await updateRunStatus(runId, status, extra);
  const frame: ITelemetryFrame = {
    type: status === 'THINKING' ? 'thinking'
      : status === 'EXECUTING_TOOL' ? 'tool_start'
      : status === 'AWAITING_CONFIRMATION' ? 'action_required'
      : status === 'COMPLETE' ? 'complete'
      : 'thinking',
    message,
    timestamp: new Date().toISOString(),
  };
  const event = await insertRunEvent(runId, frame.type, frame.message, frame.payload);
  hooks.onFrame(frame);
  broadcast(runId, frame, event.id);
}

async function fail(runId: string, message: string, hooks: IRunHooks) {
  await transition(runId, 'FAILED', message, hooks);
}

async function cancel(runId: string, hooks: IRunHooks) {
  await transition(runId, 'CANCELLED', 'Run was cancelled.', hooks);
}

function createRunHooks(runId: string): IRunHooks {
  return {
    onFrame(frame: ITelemetryFrame) {
      broadcast(runId, frame);
    },
  };
}

function extractSearchParameters(input?: Record<string, unknown>): IBrowserToolInvocation['searchParameters'] {
  return {
    location: (input?.location as string) ?? 'Unknown',
    maxBudget: (input?.maxBudget as number) ?? 300,
    preferences: (input?.preferences as string[]) ?? [],
  };
}
