// PERSON A — Mock tool executor (Day 1)
// A fake executeBrowserTask that sleeps 3s and returns canned hotel data.
// Lets Person A finish the entire pipeline without Person B.
// On Day 5, swap: import { executeBrowserTask } from '../tools/browserCore.js';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';

/**
 * Mock implementation of Person B's executeBrowserTask.
 * Simulates browser automation with artificial delays and canned data.
 */
export async function executeBrowserTask(
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const { runId, searchParameters } = invocation;

  // ── Phase 1: Starting browser session ────────────────────────────────
  hooks.onFrame({
    type: 'tool_start',
    message: `Launching headless browser for ${searchParameters.location}...`,
    timestamp: new Date().toISOString(),
  });
  await sleep(1000);

  // ── Phase 2: Navigating and searching ────────────────────────────────
  hooks.onFrame({
    type: 'thinking',
    message: `Searching hotels in ${searchParameters.location} under $${searchParameters.maxBudget}/night...`,
    timestamp: new Date().toISOString(),
  });
  await sleep(1000);

  // ── Phase 3: Scraping results ────────────────────────────────────────
  hooks.onFrame({
    type: 'viewport_update',
    message: 'Scraping search results...',
    timestamp: new Date().toISOString(),
    payload: {
      screenshotUrl: 'https://placeholder.screenshot/expedia-results.png',
    },
  });
  await sleep(1000);

  // ── Phase 4: Return canned data ──────────────────────────────────────
  hooks.onFrame({
    type: 'complete',
    message: 'Found matching hotel. Ready for review.',
    timestamp: new Date().toISOString(),
  });

  return {
    status: 'SUCCESS',
    scrapedData: {
      entityName: `Grand Hyatt ${searchParameters.location}`,
      priceDisplay: `$${Math.min(searchParameters.maxBudget - 20, 179)}/night`,
      summaryDetails: `4-star hotel in downtown ${searchParameters.location}. Free WiFi, pool, fitness center. ${searchParameters.preferences?.length ? `Matches preferences: ${searchParameters.preferences.join(', ')}` : 'No specific preferences applied.'}`,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
