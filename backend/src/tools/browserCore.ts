// PERSON B — Browserbase session lifecycle + the top-level orchestration entrypoint.
// truth/backend.md §10 states the eventual orchestrator does
// `import { executeBrowserTask } from '../tools/browserCore'` — so this file owns that
// export; expediaMacro.ts holds the pure page-interaction steps this file delegates to.
import { Stagehand } from '@browserbasehq/stagehand';
import Browserbase from '@browserbasehq/sdk';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { runSearchAndCheckout } from './expediaMacro.js';
import { startScreenshotLoop } from './screenshotter.js';

/**
 * Resolves a Browserbase Context id to persist cookies/login across runs.
 * If the invocation already carries one, reuse it as-is. Otherwise mint a fresh one.
 * Never resolves or passes a project id — the Browserbase API key alone identifies
 * the project, and `contexts.create()` infers it automatically.
 */
export async function resolveContextId(existingContextId: string): Promise<string | undefined> {
  if (existingContextId) return existingContextId;
  try {
    const client = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    const context = await client.contexts.create();
    return context.id;
  } catch {
    // No context available yet (e.g. free-tier limits) — proceed without a persisted
    // cookie context rather than blocking the run on it.
    return undefined;
  }
}

export async function createSession(contextId: string | undefined): Promise<Stagehand> {
  // ── Model choice ──────────────────────────────────────────────────────────
  // Stagehand's act()/observe()/extract() rely on VISION to understand screenshots,
  // popups, and page layout. DeepSeek v4 Pro is a reasoning model — it cannot
  // interpret screenshots. GPT-4o has native vision support and is the recommended
  // model for Stagehand browser automation.
  //
  // Override with STAGEHAND_MODEL env var if you want to use a different vision model
  // (e.g. 'claude-3.5-sonnet' or 'gpt-4o-mini' for lower cost).
  // NOTE: Stagehand requires "provider/model" format, and DigitalOcean's gateway
  // serves provider-prefixed ids (e.g. 'anthropic-claude-4.5-sonnet'). The
  // anthropic provider is the only one whose wire format the DO gateway
  // implements to spec: 'openai/...' routes to /v1/responses, which the gateway
  // serves with non-spec field shapes that the AI SDK rejects ("Invalid JSON
  // response"), and openai-compatible providers use json_object mode, which
  // errors unless prompts contain the word "json".
  const stagehandModel = process.env.STAGEHAND_MODEL ?? 'anthropic/anthropic-claude-4.5-sonnet';

  const useBrowserbase = Boolean(process.env.BROWSERBASE_API_KEY);

  const stagehandConfig: ConstructorParameters<typeof Stagehand>[0] = {
    env: useBrowserbase ? 'BROWSERBASE' : 'LOCAL',
    model: {
      modelName: stagehandModel,
      apiKey: process.env.DIGITAL_OCEAN_MODEL_ACCESS_KEY ?? '',
      baseURL: 'https://inference.do-ai.run/v1',
    },
    domSettleTimeout: 60_000,
    verbose: 1,
  };

  // Wire Browserbase context for cookie/login persistence across runs
  if (useBrowserbase && contextId) {
    stagehandConfig.browserbaseSessionCreateParams = {
      browserSettings: {
        context: { id: contextId, persist: true },
      },
    };
  }

  // LOCAL-only options (ignored when env: 'BROWSERBASE')
  if (!useBrowserbase) {
    stagehandConfig.localBrowserLaunchOptions = {
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
  }

  const stagehand = new Stagehand(stagehandConfig);
  await stagehand.init();
  return stagehand;
}

/**
 * Fetch the Browserbase Session Live View URL — a fully interactive, real-time
 * view of the cloud browser that can be embedded in an iframe. Unlike the
 * screenshot loop, the operator can click/type through it (dismiss popups,
 * complete logins, solve CAPTCHAs) while the agent works.
 */
export async function getLiveViewUrl(sessionId: string): Promise<string | undefined> {
  try {
    const client = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    const debug = await client.sessions.debug(sessionId);
    return debug.debuggerFullscreenUrl;
  } catch {
    return undefined;
  }
}

export async function teardownSession(stagehand: Stagehand): Promise<void> {
  await stagehand.close();
}

// ── Per-run session registry (P3) ─────────────────────────────────────────
// One Browserbase session is opened on the first tool call of a run and kept
// alive across subsequent calls (search → book) and until the run finalizes.
// This keeps the live view connected the whole time (no mid-flow white-out),
// preserves cookies/popups-dismissed state, and lets book mode resume in the
// same session instead of paying for a fresh spawn.
interface SessionEntry {
  stagehand: Stagehand;
  stopScreenshots: () => void;
}
const sessions = new Map<string, SessionEntry>();

async function getOrCreateSession(
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<Stagehand> {
  // Safety: a new run supersedes any leftover session so only one live browser
  // exists at a time (the orchestrator normally closes each run's session already).
  for (const otherId of [...sessions.keys()]) {
    if (otherId !== invocation.runId) await closeBrowserSession(otherId);
  }

  const existing = sessions.get(invocation.runId);
  if (existing) return existing.stagehand;

  hooks.onFrame({
    type: 'thinking',
    message: 'Hydrating Browserbase session...',
    timestamp: new Date().toISOString(),
  });

  const contextId = await resolveContextId(invocation.browserbaseContextId);
  const stagehand = await createSession(contextId);

  hooks.onFrame({
    type: 'tool_start',
    message: `Spawning headless Chrome node on Browserbase (session ${stagehand.browserbaseSessionID ?? 'unknown'})...`,
    timestamp: new Date().toISOString(),
  });

  // Surface the Browserbase Live View so the operator can watch — and interact
  // with — the real browser (dismiss popups, solve CAPTCHAs).
  if (stagehand.browserbaseSessionID) {
    const liveViewUrl = await getLiveViewUrl(stagehand.browserbaseSessionID);
    if (liveViewUrl) {
      hooks.onFrame({
        type: 'tool_start',
        message: 'Live browser view available',
        timestamp: new Date().toISOString(),
        payload: { liveViewUrl },
      });
    }
  }

  const page = await stagehand.context.awaitActivePage();
  const stopScreenshots = startScreenshotLoop(page, hooks);
  sessions.set(invocation.runId, { stagehand, stopScreenshots });
  return stagehand;
}

/**
 * The frozen entrypoint the orchestrator calls per tool invocation. Reuses the
 * run's live Browserbase session (opening one on first use). The session is NOT
 * torn down here — the orchestrator calls closeBrowserSession() when the whole
 * run finalizes.
 */
export async function executeBrowserTask(
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const stagehand = await getOrCreateSession(invocation, hooks);
  try {
    return await runSearchAndCheckout(stagehand, invocation, hooks);
  } catch (err) {
    return {
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Tear down a run's Browserbase session immediately. Safe to call for runs that
 * never opened a session.
 */
export async function closeBrowserSession(runId: string): Promise<void> {
  const entry = sessions.get(runId);
  if (!entry) return;
  sessions.delete(runId);
  try { entry.stopScreenshots(); } catch { /* already stopped */ }
  try { await teardownSession(entry.stagehand); } catch { /* already closed */ }
}
