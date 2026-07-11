// PERSON B — Search, extract, and checkout page-interaction logic.
// Pure Stagehand step functions consumed only by browserCore.ts (the session-lifecycle
// owner and the frozen `executeBrowserTask` entrypoint per truth/backend.md §10).
import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { requestAuthorization } from './guardrails.js';

const HotelResultSchema = z.object({
  entityName: z.string(),
  priceDisplay: z.string(),
  summaryDetails: z.string(),
});

const HotelResultsSchema = z.object({ results: z.array(HotelResultSchema) });

type HotelResult = z.infer<typeof HotelResultSchema>;

function parsePrice(priceDisplay: string): number {
  const match = priceDisplay.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

function pickCandidate(results: HotelResult[], invocation: IBrowserToolInvocation): HotelResult | undefined {
  const withinBudget = results.filter((r) => parsePrice(r.priceDisplay) <= invocation.searchParameters.maxBudget);
  const pool = withinBudget.length > 0 ? withinBudget : results;
  const preferenceMatch = pool.find((r) =>
    invocation.searchParameters.preferences.some((pref) =>
      r.summaryDetails.toLowerCase().includes(pref.toLowerCase()),
    ),
  );
  return preferenceMatch ?? pool[0];
}

/**
 * Detects a bot-protection interstitial (Akamai/PerimeterX/Cloudflare-class challenges).
 * Large travel retailers commonly gate automated traffic this way, and the free
 * Browserbase plan has no Proxies/Verified to get past it — so this must fail
 * gracefully rather than hang or throw an opaque error.
 */
async function detectBotProtection(stagehand: Stagehand): Promise<boolean> {
  const [challenge] = await stagehand.observe(
    'is there a bot-detection, CAPTCHA, or "verify you are human" interstitial covering the page',
  );
  return Boolean(challenge);
}

export async function runSearchAndCheckout(
  stagehand: Stagehand,
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const page = await stagehand.context.awaitActivePage();

  hooks.onFrame({
    type: 'tool_start',
    message: `Navigating to ${invocation.targetUrl}`,
    timestamp: new Date().toISOString(),
  });
  await page.goto(invocation.targetUrl, { waitUntil: 'domcontentloaded' });

  if (await detectBotProtection(stagehand)) {
    return {
      status: 'FAILED',
      errorMessage:
        'Target site returned a bot-protection challenge (Akamai/PerimeterX-class); the Browserbase ' +
        'free tier has no Proxies/Verified to bypass it. Re-run against the fallback demo target.',
    };
  }

  hooks.onFrame({
    type: 'thinking',
    message: `Searching for hotels in ${invocation.searchParameters.location}...`,
    timestamp: new Date().toISOString(),
  });
  const [searchAction] = await stagehand.observe('search for hotels in %location%');
  if (searchAction) {
    await stagehand.act(searchAction, { variables: { location: invocation.searchParameters.location } });
  } else {
    await stagehand.act(`search for hotels in ${invocation.searchParameters.location}`);
  }

  hooks.onFrame({
    type: 'tool_start',
    message: 'Extracting search results...',
    timestamp: new Date().toISOString(),
  });
  const { results } = await stagehand.extract(
    'extract the visible hotel search results, including their name, displayed price, and a short summary',
    HotelResultsSchema,
  );

  if (results.length === 0) {
    return { status: 'FAILED', errorMessage: 'No hotel results were found on the page.' };
  }

  const candidate = pickCandidate(results, invocation);
  if (!candidate) {
    return { status: 'FAILED', errorMessage: 'No hotel candidate matched the search parameters.' };
  }

  hooks.onFrame({
    type: 'thinking',
    message: `Selected ${candidate.entityName} at ${candidate.priceDisplay}`,
    timestamp: new Date().toISOString(),
  });

  await stagehand.act(`click on the search result for ${candidate.entityName}`);
  await stagehand.act('proceed to checkout / booking with the default guest and date details');

  const decision = await requestAuthorization(
    invocation.runId,
    { title: candidate.entityName, cost: candidate.priceDisplay },
    hooks,
  );

  if (decision === 'cancel') {
    // Per truth/backend.md §5: a cancel at the guardrail aborts the run and
    // surfaces as FAILED with a user-cancelled reason, not a distinct terminal status.
    return { status: 'FAILED', errorMessage: 'Cancelled at guardrail by operator.' };
  }

  await stagehand.act('click the final confirm and book button');

  hooks.onFrame({
    type: 'complete',
    message: `Booking confirmed for ${candidate.entityName}`,
    timestamp: new Date().toISOString(),
  });

  return { status: 'SUCCESS', scrapedData: candidate };
}
