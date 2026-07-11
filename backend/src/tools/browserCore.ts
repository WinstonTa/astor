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
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    model: 'anthropic/claude-sonnet-4-6',
    cacheDir: '.stagehand-cache',
    domSettleTimeout: 30_000,
    verbose: 1,
    browserbaseSessionCreateParams: contextId
      ? { browserSettings: { context: { id: contextId, persist: true } } }
      : undefined,
  });
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
