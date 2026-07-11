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

/**
 * Rank options for the LLM to present: within-budget first, cheapest first,
 * and any preference match bubbled to the top. The agent makes the final call —
 * this is only a sensible default ordering, not an auto-selection.
 */
function rankOptions(results: HotelResult[], invocation: IBrowserToolInvocation): HotelResult[] {
  const budget = invocation.searchParameters.maxBudget;
  const prefs = invocation.searchParameters.preferences ?? [];
  const scored = [...results].sort((a, b) => {
    const aIn = parsePrice(a.priceDisplay) <= budget ? 0 : 1;
    const bIn = parsePrice(b.priceDisplay) <= budget ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return parsePrice(a.priceDisplay) - parsePrice(b.priceDisplay);
  });
  const prefMatch = scored.findIndex((r) =>
    prefs.some((p) => r.summaryDetails.toLowerCase().includes(p.toLowerCase())),
  );
  if (prefMatch > 0) {
    const [m] = scored.splice(prefMatch, 1);
    scored.unshift(m);
  }
  return scored;
}

// ── Popup & bot-protection handling ──────────────────────────────────────────

/**
 * Fast, mostly-free popup dismissal. Clicks known consent/close controls directly
 * in the page (no LLM) and fires an Escape keydown for JS modals; escalates to a
 * single vision-model act() only if a blocking dialog remains. Every act() call
 * previously here cost a full accessibility-tree round trip (20k–40k tokens) that
 * usually matched nothing.
 */
async function dismissPopups(stagehand: Stagehand, page: Page): Promise<void> {
  let clickedAny = false;
  let stillBlocked = false;
  try {
    const outcome = await page.evaluate(() => {
      const selectors = [
        '#onetrust-accept-btn-handler',
        '[aria-label="Accept"]',
        '[data-testid="cookie-banner"] button',
      ];
      const textMatches = ['accept all', 'accept', 'ok', 'got it', 'no thanks', 'dismiss', 'close'];
      let clicked = false;

      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el && el.offsetParent !== null) { el.click(); clicked = true; }
      }
      // Buttons/aria-labels matched by visible text
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('button, [role="button"], [aria-label]'),
      );
      for (const el of candidates) {
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
        if (label && textMatches.some((t) => label === t || label.startsWith(t)) && el.offsetParent !== null) {
          el.click();
          clicked = true;
        }
      }
      // Fire Escape for JS-driven modals
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]') as HTMLElement | null;
      const blocked = !!dialog && dialog.offsetParent !== null;
      return { clicked, blocked };
    });
    clickedAny = outcome.clicked;
    stillBlocked = outcome.blocked;
  } catch {
    // page.evaluate failed (mid-navigation) — fall through
  }

  await new Promise(r => setTimeout(r, POST_POPUP_MS));

  // Escalate to the vision model only if a modal is still blocking and we couldn't clear it.
  if (stillBlocked && !clickedAny) {
    try {
      await stagehand.act('close the modal dialog or popup covering the page by clicking its close or dismiss button');
      await new Promise(r => setTimeout(r, POST_POPUP_MS));
    } catch {
      // nothing actionable — proceed
    }
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

// ── UI-driven search fallback ────────────────────────────────────────────────

/**
 * Deterministically pick a booking.com calendar cell. The calendar renders each
 * day as a cell carrying `data-date="YYYY-MM-DD"`, so we can click the exact date
 * (advancing months if needed) instead of asking the vision model to read the
 * calendar — which previously chose the wrong days (e.g. Jul 1/24 for a Jul 18–20
 * request) and cost several LLM calls. Returns true on success.
 */
async function pickCalendarDate(page: Page, isoDate: string): Promise<boolean> {
  for (let advance = 0; advance < 13; advance++) {
    const result = await page
      .evaluate((iso: string) => {
        const cell = document.querySelector(
          `[data-date="${iso}"]`,
        ) as HTMLElement | null;
        if (cell && cell.offsetParent !== null) {
          cell.click();
          return 'clicked';
        }
        const next = document.querySelector(
          '[aria-label="Next month"], button[aria-label*="Next"]',
        ) as HTMLElement | null;
        if (next && next.offsetParent !== null) {
          next.click();
          return 'advanced';
        }
        return 'none';
      }, isoDate)
      .catch(() => 'none');

    if (result === 'clicked') return true;
    if (result === 'none') break;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

/**
 * Booking.com (and most travel sites) reject deep-linked searches from
 * datacenter IPs and bounce to the homepage. When that happens, drive the
 * site's own search UI instead — type the destination, pick dates deterministically,
 * submit. Only the destination field (autocomplete is dynamic) uses the LLM.
 */
async function uiSearchFallback(
  stagehand: Stagehand,
  page: Page,
  invocation: IBrowserToolInvocation,
  checkIn: string,
  checkOut: string,
  hooks: IRunHooks,
): Promise<void> {
  hooks.onFrame({
    type: 'tool_start',
    message: 'Deep-link search was rejected — searching via the site UI instead...',
    timestamp: new Date().toISOString(),
  });

  // Destination + its autocomplete are genuinely dynamic → let the model handle them.
  try {
    await stagehand.act(
      `click the destination search input (e.g. "Where are you going?") and type "${invocation.searchParameters.location}"`,
    );
    await new Promise((r) => setTimeout(r, POST_POPUP_MS));
    await stagehand.act('click the first suggestion in the destination autocomplete dropdown');
    await new Promise((r) => setTimeout(r, POST_POPUP_MS));
  } catch {
    // Continue — the calendar may already be open.
  }

  // Dates: deterministic, no LLM. Fall back to the model only if the cells aren't found.
  const gotCheckIn = await pickCalendarDate(page, checkIn);
  const gotCheckOut = await pickCalendarDate(page, checkOut);
  if (!gotCheckIn || !gotCheckOut) {
    try {
      await stagehand.act(`in the date picker, select check-in ${checkIn} and check-out ${checkOut}`);
    } catch {
      // proceed — extraction step will surface any failure
    }
  }

  try {
    await stagehand.act('click the Search button to run the hotel search');
  } catch {
    await page
      .evaluate(() => {
        const btn = Array.from(document.querySelectorAll<HTMLElement>('button, [type="submit"]')).find(
          (b) => (b.textContent || '').trim().toLowerCase().includes('search'),
        );
        btn?.click();
      })
      .catch(() => {});
  }

  await waitForPageSettle(page);
  await dismissPopups(stagehand, page);
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
  const targetHost = new URL(invocation.targetUrl).hostname;

  // Site-aware search URL. Booking.com has a stable, documented query-param
  // format; the trivago slug scheme is a best-effort guess kept as fallback.
  let searchUrl: string;
  if (targetHost.includes('booking.com')) {
    searchUrl =
      `${invocation.targetUrl}/searchresults.html` +
      `?ss=${encodeURIComponent(invocation.searchParameters.location)}` +
      `&checkin=${checkIn}&checkout=${checkOut}&group_adults=2&no_rooms=1&group_children=0`;
  } else {
    const locationSlug = invocation.searchParameters.location.toLowerCase().replace(/[,\s]+/g, '-');
    searchUrl = `${invocation.targetUrl}/en-US/srl/hotels-${encodeURIComponent(locationSlug)}?search=${encodeURIComponent(invocation.searchParameters.location)}&dates=${checkIn}~${checkOut}&adults=2&rooms=1`;
  }

  // ── BOOK MODE: guardrail first, then best-effort checkout ────────────────
  // The confirmation must be reliable and independent of scraping — we already
  // have the hotel name + price from the search the user just approved, so we ask
  // for authorization immediately rather than re-running the fragile search first
  // (which could fail before the user is ever asked to confirm).
  if (invocation.mode === 'book') {
    return await runBooking(stagehand, page, invocation, searchUrl, targetHost, checkIn, checkOut, hooks);
  }

  // ── SEARCH MODE ──────────────────────────────────────────────────────────
  hooks.onFrame({
    type: 'tool_start',
    message: `Navigating to ${targetHost} for ${invocation.searchParameters.location} (${checkIn} → ${checkOut})...`,
    timestamp: new Date().toISOString(),
  });

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await waitForPageSettle(page);
  await dismissPopups(stagehand, page);

  // Deep-link rejected? Search through the site UI instead.
  if (targetHost.includes('booking.com') && !page.url().includes('searchresults')) {
    await uiSearchFallback(stagehand, page, invocation, checkIn, checkOut, hooks);
  }

  hooks.onFrame({
    type: 'thinking',
    message: `Searching for hotels in ${invocation.searchParameters.location}...`,
    timestamp: new Date().toISOString(),
  });

  const { results, error: extractError } = await extractResults(stagehand, page, hooks);
  if (extractError) {
    // Only now — when we got nothing — pay for a bot-protection check, so we can
    // give the operator an actionable message instead of a generic failure.
    if (await detectBotProtection(stagehand, page)) {
      return {
        status: 'FAILED',
        errorMessage:
          'Target site returned a bot-protection challenge. Possible fixes:\n' +
          '1. Enable Browserbase Proxies/Advanced Stealth (Scale plan) to bypass bot detection\n' +
          '2. Try a different, less aggressive target site',
      };
    }
    return { status: 'FAILED', errorMessage: extractError };
  }

  // Return the ranked options to the LLM — the agent presents them, recommends the
  // best, and only books after the user confirms. No auto-purchase here.
  const ranked = rankOptions(results, invocation);
  hooks.onFrame({
    type: 'thinking',
    message: `Found ${ranked.length} hotels in ${invocation.searchParameters.location}.`,
    timestamp: new Date().toISOString(),
  });
  return { status: 'SUCCESS', scrapedData: ranked[0], options: ranked };
}

/**
 * Book flow. Raises the purchase guardrail FIRST using the name/price the agent
 * already holds, so the human-in-the-loop confirmation never depends on a second
 * scrape succeeding. The actual on-site checkout after authorization is
 * best-effort and never fails the run — the booking is considered confirmed the
 * moment the user authorizes it.
 */
async function runBooking(
  stagehand: Stagehand,
  page: Page,
  invocation: IBrowserToolInvocation,
  searchUrl: string,
  targetHost: string,
  checkIn: string,
  checkOut: string,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const name = invocation.searchParameters.selectedHotelName ?? 'the selected hotel';
  const price = invocation.searchParameters.selectedHotelPrice ?? 'the listed price';

  // ── Pull the user to the specific hotel's page so they can SEE what they're
  //    booking (best-effort; never fatal — we still have name+price for the card).
  hooks.onFrame({
    type: 'tool_start',
    message: `Opening ${name}...`,
    timestamp: new Date().toISOString(),
  });
  try {
    // Reused session may already be on the results page; if not, re-run the search.
    if (!page.url().includes('searchresults')) {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await waitForPageSettle(page);
      await dismissPopups(stagehand, page);
      if (targetHost.includes('booking.com') && !page.url().includes('searchresults')) {
        await uiSearchFallback(stagehand, page, invocation, checkIn, checkOut, hooks);
      }
    }
    await stagehand.act(`click on the search result for "${name}" to open its detail/property page`);
    await waitForPageSettle(page);
  } catch {
    // Opening the exact page failed — non-fatal; the confirmation card still works.
  }

  // ── Guardrail: pause for user authorization (reliable — uses name+price we
  //    already hold, independent of whether the page opened) ──────────────────
  const decision = await requestAuthorization(invocation.runId, { title: name, cost: price }, hooks);
  if (decision === 'cancel') {
    return { status: 'FAILED', errorMessage: 'Cancelled at guardrail by operator.' };
  }

  // ── Reveal availability so the hotel/room page is on screen. Payment and
  //    credit-card entry are intentionally SKIPPED for this demo. ─────────────
  try {
    await stagehand.act(
      'click the "See availability", "Reserve", or "Book now" button to show the room/booking page — do NOT enter any payment or credit-card details',
    );
    await waitForPageSettle(page);
  } catch {
    // Non-fatal — the user has already authorized.
  }

  // NOTE: deliberately NOT a 'complete' frame — only the orchestrator's terminal
  // transition may end the run.
  hooks.onFrame({
    type: 'tool_start',
    message: `Booking confirmed: ${name} at ${price}. Payment/checkout skipped for this demo.`,
    timestamp: new Date().toISOString(),
  });

  return {
    status: 'SUCCESS',
    scrapedData: {
      entityName: name,
      priceDisplay: price,
      summaryDetails: 'Authorized by the user. Payment/checkout intentionally skipped for this demo.',
    },
  };
}
