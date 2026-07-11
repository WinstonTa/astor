// Flight search, extract, and booking logic via Google Flights.
// Mirrors expediaMacro.ts but targets flights.google.com.
import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { requestAuthorization } from './guardrails.js';

type Page = Awaited<ReturnType<Stagehand['context']['awaitActivePage']>>;

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_RETRIES = 2;
const EXTRACT_TIMEOUT_MS = 60_000;
const DOM_SETTLE_MS = 4_000;
const POST_POPUP_MS = 1_500;

// ── Schemas ──────────────────────────────────────────────────────────────────
const FlightResultSchema = z.object({
  entityName: z.string(),      // e.g. "United Airlines — UA 241"
  priceDisplay: z.string(),    // e.g. "$312"
  summaryDetails: z.string(),  // e.g. "Nonstop · 5h 30m · Departs 8:00 AM"
});

const FlightResultsSchema = z.object({ results: z.array(FlightResultSchema) });

type FlightResult = z.infer<typeof FlightResultSchema>;

// ── Preference parsing ───────────────────────────────────────────────────────
// The frozen IBrowserToolInvocation contract encodes flight-specific data in
// the preferences array as "key:value" strings.
function extractPref(prefs: string[], key: string): string | undefined {
  return prefs.find((p) => p.startsWith(`${key}:`))?.slice(key.length + 1);
}

function getDestination(invocation: IBrowserToolInvocation): string {
  return extractPref(invocation.searchParameters.preferences, 'destination') ?? 'Unknown';
}

function getPassengers(invocation: IBrowserToolInvocation): string {
  return extractPref(invocation.searchParameters.preferences, 'passengers') ?? '1';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(priceDisplay: string): number {
  const match = priceDisplay.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

function rankOptions(results: FlightResult[], invocation: IBrowserToolInvocation): FlightResult[] {
  const budget = invocation.searchParameters.maxBudget;
  const prefs = invocation.searchParameters.preferences ?? [];
  const scored = [...results].sort((a, b) => {
    const aIn = parsePrice(a.priceDisplay) <= budget ? 0 : 1;
    const bIn = parsePrice(b.priceDisplay) <= budget ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return parsePrice(a.priceDisplay) - parsePrice(b.priceDisplay);
  });
  // Prefer non-stop flights
  const nonStopIdx = scored.findIndex((r) => r.summaryDetails.toLowerCase().includes('nonstop'));
  if (nonStopIdx > 0) {
    const [m] = scored.splice(nonStopIdx, 1);
    scored.unshift(m);
  }
  return scored;
}

// ── Popup & bot-protection handling ──────────────────────────────────────────

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
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]') as HTMLElement | null;
      const blocked = !!dialog && dialog.offsetParent !== null;
      return { clicked, blocked };
    });
    clickedAny = outcome.clicked;
    stillBlocked = outcome.blocked;
  } catch {
    // page.evaluate failed (mid-navigation)
  }

  await new Promise(r => setTimeout(r, POST_POPUP_MS));

  if (stillBlocked && !clickedAny) {
    try {
      await stagehand.act('close the modal dialog or popup covering the page by clicking its close or dismiss button');
      await new Promise(r => setTimeout(r, POST_POPUP_MS));
    } catch {
      // nothing actionable
    }
  }
}

async function detectBotProtection(stagehand: Stagehand, page: Page): Promise<boolean> {
  try {
    const observations = await stagehand.observe(
      'is there a bot-detection, CAPTCHA, "verify you are human", or "access denied" interstitial covering the page',
    );
    if (observations.length > 0) return true;
  } catch {
    // observe failed
  }

  try {
    const hasChallenge = await page.evaluate(() => {
      const body = document.body?.innerText?.toLowerCase() ?? '';
      const challengePhrases = [
        'verify you are human', 'access denied', 'blocked', 'captcha',
        'please wait while we verify', 'checking your browser', 'ray id', 'cf-challenge',
      ];
      return challengePhrases.some(phrase => body.includes(phrase));
    });
    if (hasChallenge) return true;
  } catch {
    // page.evaluate failed
  }

  return false;
}

async function waitForPageSettle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle').catch(() => {});
  } catch {
    // timeout is fine
  }
  await new Promise(r => setTimeout(r, DOM_SETTLE_MS));
}

// ── Date picker (Google Flights uses a calendar) ─────────────────────────────

async function pickCalendarDate(page: Page, isoDate: string): Promise<boolean> {
  // Google Flights calendar cells have aria-label like "Thu Jul 18 2026"
  // We try clicking by data-day or by parsing the date into an aria-label pattern.
  const date = new Date(isoDate + 'T00:00:00');
  const dayNum = date.getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[date.getMonth()];
  const year = date.getFullYear();

  for (let advance = 0; advance < 6; advance++) {
    const result = await page
      .evaluate(({ day, month }: { day: number; month: string }) => {
        // Try aria-label pattern used by Google Flights
        const cells = document.querySelectorAll<HTMLElement>('[data-day], [role="gridcell"], td[aria-label]');
        for (const cell of cells) {
          const label = cell.getAttribute('aria-label') || '';
          const dataDay = cell.getAttribute('data-day') || '';
          // Match by day number and month in the aria-label
          if ((label.includes(month) && label.includes(String(day))) ||
              (dataDay === String(day) && cell.offsetParent !== null)) {
            cell.click();
            return 'clicked';
          }
        }
        // Try next month button
        const next = document.querySelector(
          '[aria-label*="next"], [aria-label*="Next"], button[aria-label*="forward"]',
        ) as HTMLElement | null;
        if (next && next.offsetParent !== null) {
          next.click();
          return 'advanced';
        }
        return 'none';
      }, { day: dayNum, month: monthName })
      .catch(() => 'none');

    if (result === 'clicked') return true;
    if (result === 'none') break;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

// ── UI-driven search fallback ────────────────────────────────────────────────

async function uiSearchFallback(
  stagehand: Stagehand,
  page: Page,
  invocation: IBrowserToolInvocation,
  departureDate: string,
  hooks: IRunHooks,
): Promise<void> {
  hooks.onFrame({
    type: 'tool_start',
    message: 'Deep-link search was rejected — searching via the Google Flights UI instead...',
    timestamp: new Date().toISOString(),
  });

  const origin = invocation.searchParameters.location;
  const destination = getDestination(invocation);

  // Type origin
  try {
    await stagehand.act('click the "Where from?" or origin input field and clear it');
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
    await stagehand.act(`type "${origin}" into the origin field`);
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
    await stagehand.act('click the first suggestion in the origin dropdown');
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
  } catch {
    // proceed
  }

  // Type destination
  try {
    await stagehand.act('click the "Where to?" or destination input field and clear it');
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
    await stagehand.act(`type "${destination}" into the destination field`);
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
    await stagehand.act('click the first suggestion in the destination dropdown');
    await new Promise(r => setTimeout(r, POST_POPUP_MS));
  } catch {
    // proceed
  }

  // Pick departure date
  const gotDate = await pickCalendarDate(page, departureDate);
  if (!gotDate) {
    try {
      await stagehand.act(`in the date picker, select departure date ${departureDate}`);
    } catch {
      // proceed
    }
  }

  // Click search/done
  try {
    await stagehand.act('click the "Done" or "Search" button to run the flight search');
  } catch {
    await page
      .evaluate(() => {
        const btn = Array.from(document.querySelectorAll<HTMLElement>('button')).find(
          (b) => {
            const text = (b.textContent || '').trim().toLowerCase();
            return text === 'done' || text === 'search' || text.includes('search flights');
          },
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
): Promise<{ results: FlightResult[]; error?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    hooks.onFrame({
      type: 'tool_start',
      message: `Extracting flight results (attempt ${attempt}/${MAX_RETRIES})...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const extraction = await Promise.race([
        stagehand.extract(
          'extract all visible flight listings from the search results. For each flight, get: the airline name and flight number, the displayed price, and a summary with stops (nonstop, 1 stop, etc), duration, and departure/arrival times. If you see "no results" or an empty page, return an empty results array.',
          FlightResultsSchema,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Extraction timeout')), EXTRACT_TIMEOUT_MS)
        ),
      ]) as { results: FlightResult[] };

      if (extraction.results.length > 0) {
        return { results: extraction.results };
      }

      if (attempt < MAX_RETRIES) {
        hooks.onFrame({
          type: 'thinking',
          message: 'No results found on first attempt, retrying...',
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

  return { results: [], error: 'No flight results found after retries.' };
}

// ── Main flow ────────────────────────────────────────────────────────────────

export async function runFlightSearchAndCheckout(
  stagehand: Stagehand,
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const page = await stagehand.context.awaitActivePage();

  const origin = invocation.searchParameters.location;
  const destination = getDestination(invocation);
  const today = new Date();
  const defaultDeparture = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const departureDate = invocation.searchParameters.checkIn ?? defaultDeparture;

  // ── BOOK MODE ──────────────────────────────────────────────────────────
  if (invocation.mode === 'book') {
    return await runFlightBooking(stagehand, page, invocation, hooks);
  }

  // ── SEARCH MODE ──────────────────────────────────────────────────────────
  // Google Flights URL format: /travel/flights with query params
  const searchUrl = `https://www.google.com/travel/flights?q=Flights+from+${encodeURIComponent(origin)}+to+${encodeURIComponent(destination)}+on+${departureDate}&curr=USD`;

  hooks.onFrame({
    type: 'tool_start',
    message: `Searching Google Flights: ${origin} → ${destination} on ${departureDate}...`,
    timestamp: new Date().toISOString(),
  });

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await waitForPageSettle(page);
  await dismissPopups(stagehand, page);

  // If the deep-link didn't land on results, try the UI
  const pageUrl = page.url();
  if (!pageUrl.includes('/travel/flights') || pageUrl.includes('consent')) {
    await uiSearchFallback(stagehand, page, invocation, departureDate, hooks);
  }

  hooks.onFrame({
    type: 'thinking',
    message: `Extracting flight options for ${origin} → ${destination}...`,
    timestamp: new Date().toISOString(),
  });

  const { results, error: extractError } = await extractResults(stagehand, page, hooks);
  if (extractError) {
    if (await detectBotProtection(stagehand, page)) {
      return {
        status: 'FAILED',
        errorMessage:
          'Google returned a bot-protection challenge. Possible fixes:\n' +
          '1. Enable Browserbase Proxies/Advanced Stealth (Scale plan)\n' +
          '2. Try again later',
      };
    }
    return { status: 'FAILED', errorMessage: extractError };
  }

  const ranked = rankOptions(results, invocation);
  hooks.onFrame({
    type: 'thinking',
    message: `Found ${ranked.length} flights from ${origin} to ${destination}.`,
    timestamp: new Date().toISOString(),
  });
  return { status: 'SUCCESS', scrapedData: ranked[0], options: ranked };
}

// ── Booking flow ─────────────────────────────────────────────────────────────

async function runFlightBooking(
  stagehand: Stagehand,
  page: Page,
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const flightName = invocation.searchParameters.selectedHotelName ?? 'the selected flight';
  const price = invocation.searchParameters.selectedHotelPrice ?? 'the listed price';

  hooks.onFrame({
    type: 'tool_start',
    message: `Opening flight details for ${flightName}...`,
    timestamp: new Date().toISOString(),
  });

  // Try to click on the specific flight result
  try {
    await stagehand.act(`click on the search result for "${flightName}" to expand its details`);
    await waitForPageSettle(page);
  } catch {
    // Non-fatal
  }

  // Guardrail: pause for user authorization
  const decision = await requestAuthorization(invocation.runId, { title: flightName, cost: price }, hooks);
  if (decision === 'cancel') {
    return { status: 'FAILED', errorMessage: 'Cancelled at guardrail by operator.' };
  }

  // Best-effort: click "Select" or "Continue" to proceed to booking
  try {
    await stagehand.act(
      'click the "Select", "Continue", or "Book" button to proceed — do NOT enter any payment or credit-card details',
    );
    await waitForPageSettle(page);
  } catch {
    // Non-fatal — user already authorized
  }

  hooks.onFrame({
    type: 'tool_start',
    message: `Flight booking confirmed: ${flightName} at ${price}. Payment/checkout skipped for this demo.`,
    timestamp: new Date().toISOString(),
  });

  return {
    status: 'SUCCESS',
    scrapedData: {
      entityName: flightName,
      priceDisplay: price,
      summaryDetails: 'Authorized by the user. Payment/checkout intentionally skipped for this demo.',
    },
  };
}
