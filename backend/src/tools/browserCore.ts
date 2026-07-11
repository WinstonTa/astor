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
  const stagehandModel = process.env.STAGEHAND_MODEL ?? 'gpt-4o';

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

export async function teardownSession(stagehand: Stagehand): Promise<void> {
  await stagehand.close();
}

/**
 * The frozen entrypoint Person A's orchestrator will eventually call. Owns the full
 * session lifecycle around a single run: hydrate → navigate/act/extract (expediaMacro)
 * → guardrail pause → teardown, always emitting telemetry via the injected hooks.
 */
export async function executeBrowserTask(
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
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

  const page = await stagehand.context.awaitActivePage();
  const stopScreenshots = startScreenshotLoop(page, hooks);

  try {
    return await runSearchAndCheckout(stagehand, invocation, hooks);
  } catch (err) {
    return {
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    stopScreenshots();
    await teardownSession(stagehand);
  }
}
