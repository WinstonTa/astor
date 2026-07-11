// PERSON A — Run lifecycle state machine
// QUEUED → HYDRATING → THINKING → EXECUTING_TOOL → AWAITING_CONFIRMATION → AWAITING_USER_INPUT → FINALIZING → COMPLETE | FAILED | CANCELLED
import type { ITelemetryFrame } from '../contracts/streamContract.js';
import type { IBrowserToolInvocation } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { compileContext } from './contextCompiler.js';
import { think, formatToolResult } from './llmClient.js';
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
import { executeBrowserTask, closeBrowserSession } from '../tools/browserCore.js';

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
// Booking.com has a stable query-param search URL (see expediaMacro.ts);
// trivago's slug format was guessed and reliably landed on empty pages.
const TOOL_TARGETS: Record<string, string> = {
  search_hotels: 'https://www.booking.com',
  book_hotel: 'https://www.booking.com',
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

    agentLog(runId, `\x1b[1m▶ RUN START\x1b[0m — ${agent.slug}: "${run.prompt}"`);

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

    // We pause for user input on real questions (an upfront clarifying question, or
    // "which of these hotels should I book?" after a search) — but NOT after a
    // booking is already confirmed, where a courtesy "Anything else?" would
    // otherwise hang the run forever in AWAITING_USER_INPUT.
    let bookedHotel: { entityName: string; priceDisplay: string } | undefined;

    // ── Tool-calling loop ──────────────────────────────────────────
    while (true) {
      if (abortController.aborted) return await cancel(runId, hooks);

      if (decision.type === 'tool_call') {
        // ── EXECUTING_TOOL ───────────────────────────────────────────
        await transition(runId, 'EXECUTING_TOOL', `Executing tool: ${decision.toolName}...`, hooks);

        // Map LLM tool call to Person B's IBrowserToolInvocation.
        // book_hotel → mode 'book' (guardrail + checkout); everything else searches only.
        const isBooking = decision.toolName === 'book_hotel';
        const toolName = decision.toolName!;
        agentLog(runId, `🔧 TOOL \x1b[1m${toolName}\x1b[0m ${JSON.stringify(decision.toolInput ?? {})}`);
        const invocation: IBrowserToolInvocation = {
          runId,
          targetUrl: TOOL_TARGETS[toolName] ?? 'https://www.booking.com',
          browserbaseContextId: '',
          mode: isBooking ? 'book' : 'search',
          searchParameters: extractSearchParameters(decision.toolInput),
        };

        // Persist the assistant's tool call to the conversation so later turns
        // (after the user picks a hotel) still remember what was searched/found —
        // otherwise the LLM loses the results and wrongly re-runs search_hotels.
        const toolCallId = `call_${Date.now()}`;
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: toolCallId,
            type: 'function',
            function: { name: toolName, arguments: JSON.stringify(decision.toolInput ?? {}) },
          }],
        });

        // Person B's executeBrowserTask handles guardrails internally:
        // expediaMacro.ts calls requestAuthorization() which emits action_required
        // and waits for resolveAuthorization() via POST /api/agent/confirm
        const result = await executeBrowserTask(invocation, hooks);

        // Persist the tool result too (the hotel list / booking outcome).
        messages.push({
          role: 'tool',
          content: formatToolResult(toolName, result),
          tool_call_id: toolCallId,
        });

        // Record a confirmed booking so it becomes a durable episodic memory
        // ("this hotel is booked by the user").
        if (isBooking && result.status === 'SUCCESS' && result.scrapedData) {
          bookedHotel = {
            entityName: result.scrapedData.entityName,
            priceDisplay: result.scrapedData.priceDisplay,
          };
        }

        if (result.status === 'FAILED') {
          return await fail(runId, result.errorMessage ?? 'Tool execution failed.', hooks);
        }

        // ── Continue LLM loop with the accumulated conversation ──────
        await transition(runId, 'THINKING', 'Processing results...', hooks);
        if (abortController.aborted) return await cancel(runId, hooks);

        decision = await think({ systemPrompt: context.systemPrompt, messages, tools });
      } else {
        // ── LLM returned text (potential question or final answer) ──
        const agentText = decision.text ?? '';

        // Persist the assistant's reply so the conversation stays coherent across
        // the user-input round trip (the presented options / recommendation).
        messages.push({ role: 'assistant', content: agentText });

        // Send agent message to user
        hooks.onFrame({
          type: 'agent_message',
          message: agentText,
          timestamp: new Date().toISOString(),
        });
        await insertRunEvent(runId, 'agent_message', agentText);

        // A question before a booking is real (clarify request, or "which hotel?"
        // after a search) → wait for the user. After the booking is confirmed, a
        // question-shaped closing is courtesy → complete instead of hanging.
        const looksLikeQuestion = agentText.includes('?') ||
          /^(what|when|where|which|how|do you|are you|can you|would you|should)/i.test(agentText);
        const isQuestion = looksLikeQuestion && !bookedHotel;

        if (isQuestion) {
          // Wait for user input
          await transition(runId, 'AWAITING_USER_INPUT', 'Waiting for user response...', hooks);

          const userReply = await waitForUserInput(runId);

          if (abortController.aborted) return await cancel(runId, hooks);

          if (!userReply) {
            // Timeout or empty reply - end the run
            return await fail(runId, 'No user response received.', hooks);
          }

          agentLog(runId, `\x1b[33m👤 user → agent:\x1b[0m "${userReply}"`);

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

    // Prefix a durable booking marker so the memory is unmistakable on recall.
    const assistantResponse = bookedHotel
      ? `BOOKED: ${bookedHotel.entityName} (${bookedHotel.priceDisplay}) — confirmed and authorized by the user.\n\n${decision.text ?? ''}`
      : decision.text ?? '';

    await writeMemory({
      userId: run.user_id,
      agentId: run.agent_id,
      runId,
      userPrompt: run.prompt,
      assistantResponse,
    });

    // ── COMPLETE ────────────────────────────────────────────────────
    if (bookedHotel) agentLog(runId, `\x1b[32m🏨 BOOKED\x1b[0m ${bookedHotel.entityName} (${bookedHotel.priceDisplay})`);
    agentLog(runId, `\x1b[32m\x1b[1m■ RUN COMPLETE\x1b[0m`);
    await transition(runId, 'COMPLETE', decision.text ?? 'Task completed successfully.', hooks);

  } catch (err: any) {
    console.error(`Run ${runId} failed:`, err);
    const hooks = createRunHooks(runId);
    await fail(runId, err.message ?? 'Unknown error', hooks);
  } finally {
    // Close the run's Browserbase session. The frontend has already frozen the
    // final captured frame (e.g. the booked hotel page) on terminal, so the panel
    // shows that instead of the live view going white. (P3)
    await closeBrowserSession(runId).catch((e) => console.error(`closeBrowserSession(${runId}):`, e));
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
  agentLog(runId, `\x1b[31m✖ FAILED\x1b[0m — ${message}`);
  await transition(runId, 'FAILED', message, hooks);
}

async function cancel(runId: string, hooks: IRunHooks) {
  await transition(runId, 'CANCELLED', 'Run was cancelled.', hooks);
}

// ── Terminal logging ───────────────────────────────────────────────────────
// Clean, readable per-run log so the agent's work is visible in the backend
// terminal (separate from Stagehand's verbose browser internals).
function agentLog(runId: string, msg: string): void {
  console.log(`\x1b[36m[agent ${runId.slice(0, 8)}]\x1b[0m ${msg}`);
}

const FRAME_ICON: Record<string, string> = {
  thinking: '·',
  tool_start: '🌐',
  action_required: '🔒',
  agent_message: '💬',
  complete: '■',
  viewport_update: '📸',
};

function createRunHooks(runId: string): IRunHooks {
  return {
    onFrame(frame: ITelemetryFrame) {
      // Log every frame except the 4s screenshot spam (huge data URIs).
      if (frame.type !== 'viewport_update') {
        agentLog(runId, `${FRAME_ICON[frame.type] ?? '·'} ${frame.message}`);
      }
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
    // book_hotel passes hotelName + price; carry them so book mode can raise the
    // confirmation guardrail immediately (independent of a fragile re-search).
    selectedHotelName: (input?.hotelName as string) ?? (input?.selectedHotelName as string) ?? undefined,
    selectedHotelPrice:
      (input?.price as string) ?? (input?.totalPrice as string) ?? (input?.selectedHotelPrice as string) ?? undefined,
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
