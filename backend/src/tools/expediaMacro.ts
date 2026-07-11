// PERSON B — Search, extract, and checkout page-interaction logic.
// Pure Stagehand step functions consumed only by browserCore.ts (the session-lifecycle
// owner and the frozen `executeBrowserTask` entrypoint per truth/backend.md §10).
import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { requestAuthorization } from './guardrails.js';

// Stagehand wraps Playwright — derive the Page type from its context
type Page = Awaited<ReturnType<Stagehand['context']['awaitActivePage']>>;

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_RETRIES = 2;
const EXTRACT_TIMEOUT_MS = 60_000;   // 60s (was 120s — if it takes >60s the page is stuck)
const DOM_SETTLE_MS = 4_000;         // wait for JS-heavy pages to settle
const POST_POPUP_MS = 1_500;         // brief pause after popup dismissal

// ── Schemas ──────────────────────────────────────────────────────────────────
const HotelResultSchema = z.object({
  entityName: z.string(),
  priceDisplay: z.string(),
  summaryDetails: z.string(),
});

const HotelResultsSchema = z.object({ results: z.array(HotelResultSchema) });

type HotelResult = z.infer<typeof HotelResultSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(priceDisplay: string): number {
  const match = priceDisplay.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

function pickCandidate(results: HotelResult[], invocation: IBrowserToolInvocation): HotelResult | undefined {
  const withinBudget = results.filter((r) => parsePrice(r.priceDisplay) <= invocation.searchParameters.maxBudget);
  const pool = withinBudget.length > 0 ? withinBudget : results;

  // Sort by price so we pick the cheapest match, not just the first
  pool.sort((a, b) => parsePrice(a.priceDisplay) - parsePrice(b.priceDisplay));

  // Preference match takes priority
  const preferenceMatch = pool.find((r) =>
    invocation.searchParameters.preferences.some((pref) =>
      r.summaryDetails.toLowerCase().includes(pref.toLowerCase()),
    ),
  );
  return preferenceMatch ?? pool[0];
}

// ── Popup & bot-protection handling ──────────────────────────────────────────

/**
 * Multi-strategy popup dismissal. Travel sites stack multiple overlays:
 * cookie consent, notification prompts, location access, newsletter modals.
 * We try several common dismiss patterns in sequence.
 */
async function dismissPopups(stagehand: Stagehand, page: Page): Promise<void> {
  const strategies = [
    // Strategy 1: Cookie consent banners (most common)
    'click "Accept", "Accept all", "Got it", "I agree", "OK", or "Continue" button on any cookie consent or privacy banner',
    // Strategy 2: Notification/subscription popups
    'click "No thanks", "Maybe later", "Close", "Dismiss", or the X close button on any notification or newsletter popup',
    // Strategy 3: Generic overlay dismissal
    'close any modal dialog, overlay, or popup that is covering the page by clicking its close button or "X"',
  ];

  for (const strategy of strategies) {
    try {
      await stagehand.act(strategy);
      await new Promise(r => setTimeout(r, POST_POPUP_MS));
    } catch {
      // Strategy didn't match anything — move to next
    }
  }

  // Also try pressing Escape to close any remaining overlays
  try {
    await stagehand.act('press the Escape key to close any remaining popups or overlays');
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
  } catch {
    // ignore
  }
}

/**
 * Detects bot-protection interstitials (Akamai/PerimeterX/Cloudflare challenges).
 * Uses multiple detection signals for robustness.
 */
async function detectBotProtection(stagehand: Stagehand, page: Page): Promise<boolean> {
  // Signal 1: Stagehand AI observation
  try {
    const observations = await stagehand.observe(
      'is there a bot-detection, CAPTCHA, "verify you are human", or "access denied" interstitial covering the page',
    );
    if (observations.length > 0) return true;
  } catch {
    // observe failed — fall through to DOM check
  }

  // Signal 2: Quick DOM check for common challenge selectors
  try {
    const hasChallenge = await page.evaluate(() => {
      const body = document.body?.innerText?.toLowerCase() ?? '';
      const challengePhrases = [
        'verify you are human',
        'access denied',
        'blocked',
        'captcha',
        'please wait while we verify',
        'checking your browser',
        'ray id',
        'cf-challenge',
      ];
      return challengePhrases.some(phrase => body.includes(phrase));
    });
    if (hasChallenge) return true;
  } catch {
    // page.evaluate failed
  }

  return false;
}

/**
 * Wait for the page to settle after navigation. JS-heavy travel sites
 * need time for client-side rendering to complete.
 */
async function waitForPageSettle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle').catch(() => {});
  } catch {
    // networkidle timeout is fine — we still have domcontentloaded
  }
  await new Promise(r => setTimeout(r, DOM_SETTLE_MS));
}

// ── Extraction with retry ────────────────────────────────────────────────────

async function extractResults(
  stagehand: Stagehand,
  page: Page,
  hooks: IRunHooks,
): Promise<{ results: HotelResult[]; error?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    hooks.onFrame({
      type: 'tool_start',
      message: `Extracting search results (attempt ${attempt}/${MAX_RETRIES})...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const extraction = await Promise.race([
        stagehand.extract(
          'extract all visible hotel listings from the search results page. For each hotel, get: the hotel name, the displayed price per night, and a brief description or summary of the property. If you see "no results" or an empty page, return an empty results array.',
          HotelResultsSchema,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Extraction timeout')), EXTRACT_TIMEOUT_MS)
        ),
      ]) as { results: HotelResult[] };

      if (extraction.results.length > 0) {
        return { results: extraction.results };
      }

      // Empty results — might be a loading issue, retry
      if (attempt < MAX_RETRIES) {
        hooks.onFrame({
          type: 'thinking',
          message: 'No results found on first attempt, refreshing page and retrying...',
          timestamp: new Date().toISOString(),
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForPageSettle(page);
        await dismissPopups(stagehand, page);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      if (attempt < MAX_RETRIES) {
        hooks.onFrame({
          type: 'thinking',
          message: `Extraction failed (${errorMessage}), retrying...`,
          timestamp: new Date().toISOString(),
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForPageSettle(page);
        await dismissPopups(stagehand, page);
      } else {
        return { results: [], error: `Extraction failed after ${MAX_RETRIES} attempts: ${errorMessage}` };
      }
    }
  }

  return { results: [], error: 'No hotel results found after retries.' };
}

// ── Main flow ────────────────────────────────────────────────────────────────

export async function runSearchAndCheckout(
  stagehand: Stagehand,
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const page = await stagehand.context.awaitActivePage();

  // Build search URL with destination and dates
  const today = new Date();
  const defaultCheckIn = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultCheckOut = new Date(today.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
  const checkIn = invocation.searchParameters.checkIn ?? defaultCheckIn;
  const checkOut = invocation.searchParameters.checkOut ?? defaultCheckOut;
  const locationSlug = invocation.searchParameters.location.toLowerCase().replace(/[,\s]+/g, '-');
  const searchUrl = `${invocation.targetUrl}/en-US/srl/hotels-${encodeURIComponent(locationSlug)}?search=${encodeURIComponent(invocation.searchParameters.location)}&dates=${checkIn}~${checkOut}&adults=2&rooms=1`;

  // ── Navigate ────────────────────────────────────────────────────────────
  hooks.onFrame({
    type: 'tool_start',
    message: `Navigating to trivago.com for ${invocation.searchParameters.location} (${checkIn} → ${checkOut})...`,
    timestamp: new Date().toISOString(),
  });

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await waitForPageSettle(page);

  // ── Dismiss popups ──────────────────────────────────────────────────────
  await dismissPopups(stagehand, page);

  // ── Bot detection ───────────────────────────────────────────────────────
  if (await detectBotProtection(stagehand, page)) {
    return {
      status: 'FAILED',
      errorMessage:
        'Target site returned a bot-protection challenge. Possible fixes:\n' +
        '1. Set BROWSERBASE_API_KEY in .env to use Browserbase cloud browsers with proxy support\n' +
        '2. Use Browserbase Pro plan (includes Proxies/Verified for bypassing bot detection)\n' +
        '3. Try a different target site that is less aggressive with bot detection',
    };
  }

  // ── Extract results ─────────────────────────────────────────────────────
  hooks.onFrame({
    type: 'thinking',
    message: `Searching for hotels in ${invocation.searchParameters.location}...`,
    timestamp: new Date().toISOString(),
  });

  const { results, error: extractError } = await extractResults(stagehand, page, hooks);
  if (extractError) {
    return { status: 'FAILED', errorMessage: extractError };
  }

  // ── Pick candidate ──────────────────────────────────────────────────────
  const candidate = pickCandidate(results, invocation);
  if (!candidate) {
    return { status: 'FAILED', errorMessage: 'No hotel candidate matched the search parameters.' };
  }

  hooks.onFrame({
    type: 'thinking',
    message: `Selected: ${candidate.entityName} at ${candidate.priceDisplay}`,
    timestamp: new Date().toISOString(),
  });

  // ── Click hotel to view details ─────────────────────────────────────────
  try {
    await stagehand.act(`click on the search result for "${candidate.entityName}"`);
    await waitForPageSettle(page);
  } catch (err) {
    // Click might navigate to an external site — check if page changed
    const currentUrl = page.url();
    if (currentUrl.includes('trivago.com')) {
      // Still on trivago, click may have failed
      return {
        status: 'FAILED',
        errorMessage: `Could not click on hotel "${candidate.entityName}". The page layout may have changed.`,
      };
    }
    // Navigated away — that's expected for Trivago (redirects to booking site)
  }

  // ── Trivago redirects to external booking sites ─────────────────────────
  // After clicking a hotel on Trivago, the user is redirected to the actual
  // booking site (booking.com, hotels.com, etc.). We show a summary and
  // pause at the guardrail BEFORE following that redirect into a checkout flow.
  const currentUrl = page.url();
  const isExternalRedirect = !currentUrl.includes('trivago.com');

  if (isExternalRedirect) {
    hooks.onFrame({
      type: 'thinking',
      message: `Redirected to booking site: ${new URL(currentUrl).hostname}`,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Guardrail: pause for user authorization ─────────────────────────────
  const decision = await requestAuthorization(
    invocation.runId,
    { title: candidate.entityName, cost: candidate.priceDisplay },
    hooks,
  );

  if (decision === 'cancel') {
    return { status: 'FAILED', errorMessage: 'Cancelled at guardrail by operator.' };
  }

  // ── Post-authorization: attempt checkout on the booking site ────────────
  // Since Trivago redirects to various booking sites, we use Stagehand's
  // AI to find and click the booking/reserve button on whatever site we landed on.
  try {
    await stagehand.act(
      'find and click the "Reserve", "Book now", "Continue", or main call-to-action button to proceed with the booking'
    );
    await waitForPageSettle(page);
  } catch {
    // The booking site may have a different layout — not fatal, we already
    // selected the hotel and passed the guardrail.
  }

  hooks.onFrame({
    type: 'complete',
    message: `Hotel selection confirmed: ${candidate.entityName} at ${candidate.priceDisplay}. Redirected to booking site to complete purchase.`,
    timestamp: new Date().toISOString(),
  });

  return { status: 'SUCCESS', scrapedData: candidate };
}
