// PERSON A — Run lifecycle state machine
// QUEUED → HYDRATING → THINKING → EXECUTING_TOOL → AWAITING_CONFIRMATION → AWAITING_USER_INPUT → FINALIZING → COMPLETE | FAILED | CANCELLED
import type { ITelemetryFrame } from '../contracts/streamContract.js';
import type { IBrowserToolInvocation } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { compileContext } from './contextCompiler.js';
import { think, continueWithToolResult, type LLMDecision } from './llmClient.js';
import { broadcast, broadcastAndClose } from './sseManager.js';
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
  | 'AWAITING_CONFIRMATION' | 'AWAITING_USER_INPUT' | 'FINALIZING'
  | 'COMPLETE' | 'FAILED' | 'CANCELLED';

// ── Active run tracking ───────────────────────────────────────────────────
const activeRuns = new Map<string, { abort: () => void }>();

// ── Pending user input tracking ──────────────────────────────────────────
interface PendingUserInput {
  resolve: (reply: string) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingUserInputs = new Map<string, PendingUserInput>();

const USER_INPUT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ── Tool-to-URL mapping for browser automation ────────────────────────────
const TOOL_TARGETS: Record<string, string> = {
  search_hotels: 'https://www.trivago.com',
  book_hotel: 'https://www.trivago.com',
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
    while (true) {
      if (abortController.aborted) return await cancel(runId, hooks);

      if (decision.type === 'tool_call') {
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
          toolInput: decision.toolInput,
          toolResult: result,
          tools,
        });
      } else {
        // ── LLM returned text (potential question or final answer) ──
        const agentText = decision.text ?? '';

        // Send agent message to user
        hooks.onFrame({
          type: 'agent_message',
          message: agentText,
          timestamp: new Date().toISOString(),
        });
        await insertRunEvent(runId, 'agent_message', agentText);

        // Check if the text looks like a question (ends with ? or contains question words)
        const isQuestion = agentText.includes('?') ||
          /^(what|when|where|which|how|do you|are you|can you|would you|should)/i.test(agentText);

        if (isQuestion) {
          // Wait for user input
          await transition(runId, 'AWAITING_USER_INPUT', 'Waiting for user response...', hooks);

          const userReply = await waitForUserInput(runId);

          if (abortController.aborted) return await cancel(runId, hooks);

          if (!userReply) {
            // Timeout or empty reply - end the run
            return await fail(runId, 'No user response received.', hooks);
          }

          // Add user reply to messages and continue
          messages.push({ role: 'user', content: userReply });

          await transition(runId, 'THINKING', 'Processing your response...', hooks);

          decision = await think({ systemPrompt: context.systemPrompt, messages, tools });
        } else {
          // Not a question - this is the final answer
          break;
        }
      }
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

// Terminal states after which the SSE stream should be closed
const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set(['COMPLETE', 'FAILED', 'CANCELLED']);

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

  if (TERMINAL_STATUSES.has(status)) {
    // Terminal state — send final event and close all SSE connections
    broadcastAndClose(runId, frame, event.id);
  } else {
    broadcast(runId, frame, event.id);
  }
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
    checkIn: input?.checkIn as string | undefined,
    checkOut: input?.checkOut as string | undefined,
  };
}

/**
 * Wait for user input. Returns the user's reply or null on timeout.
 */
function waitForUserInput(runId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingUserInputs.delete(runId);
      resolve(null);
    }, USER_INPUT_TIMEOUT_MS);

    pendingUserInputs.set(runId, { resolve, timeout });
  });
}

/**
 * Submit a user reply to a waiting run. Called by the API endpoint.
 */
export function submitUserReply(runId: string, reply: string): boolean {
  const entry = pendingUserInputs.get(runId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pendingUserInputs.delete(runId);
  entry.resolve(reply);
  return true;
}
