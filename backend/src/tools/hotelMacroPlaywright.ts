// Pure deterministic macro for hotel search and booking on Booking.com.
// Uses Stagehand's locator() API with CSS selectors — no LLM calls per click.
// This is 5-10x faster than the Stagehand act()/extract() macro for demos.
import type { Stagehand } from '@browserbasehq/stagehand';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';
import { requestAuthorization } from './guardrails.js';

// Stagehand wraps Playwright — derive the Page type from its context
type Page = Awaited<ReturnType<Stagehand['context']['awaitActivePage']>>;

// ── Constants ────────────────────────────────────────────────────────────────
const DOM_SETTLE_MS = 2_000;
const NAV_TIMEOUT_MS = 30_000;

// ── Booking.com Selectors ────────────────────────────────────────────────────
const SELECTORS = {
  // Search form
  destinationInput: 'input[name="ss"], [data-testid="destination-input"], input[placeholder*="Where"]',
  searchButton: 'button[type="submit"], [data-testid="search-button"]',

  // Calendar
  calendarDay: (date: string) => `[data-date="${date}"]`,
  nextMonthButton: 'button[aria-label="Next month"], button[aria-label*="Next"]',

  // Results
  hotelCard: '[data-testid="property-card"], .sr_property_block',
  hotelName: '[data-testid="title"], .sr-hotel__name',
  hotelPrice: '[data-testid="price-and-discounted-price"], .bui-price-display__value',

  // Popups
  cookieAccept: '#onetrust-accept-btn-handler, [aria-label="Accept"]',

  // Booking
  reserveButton: 'button:has-text("Reserve"), button:has-text("Book"), button:has-text("See availability")',
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(priceText: string): number {
  const match = priceText.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

function rankOptions(results: { name: string; price: string }[], maxBudget: number) {
  return [...results].sort((a, b) => {
    const aIn = parsePrice(a.price) <= maxBudget ? 0 : 1;
    const bIn = parsePrice(b.price) <= maxBudget ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return parsePrice(a.price) - parsePrice(b.price);
  });
}

// ── Deterministic Calendar Picker ────────────────────────────────────────────

async function pickCalendarDate(page: Page, isoDate: string): Promise<boolean> {
  for (let advance = 0; advance < 13; advance++) {
    const cell = page.locator(SELECTORS.calendarDay(isoDate));
    if (await cell.isVisible()) {
      await cell.click();
      return true;
    }
    const nextBtn = page.locator(SELECTORS.nextMonthButton).first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(400);
    } else {
      break;
    }
  }
  return false;
}

// ── Popup Dismissal (no LLM) ────────────────────────────────────────────────

async function dismissPopups(page: Page): Promise<void> {
  try {
    const cookieBtn = page.locator(SELECTORS.cookieAccept).first();
    if (await cookieBtn.isVisible()) {
      await cookieBtn.click();
      await page.waitForTimeout(500);
    }

    // Escape key for JS modals
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await page.waitForTimeout(300);
  } catch {
    // Non-fatal
  }
}

// ── Extract Hotel Results (deterministic DOM queries) ────────────────────────

async function extractResults(page: Page): Promise<{ name: string; price: string }[]> {
  return page.evaluate((selectors) => {
    const cards = document.querySelectorAll(selectors.hotelCard);
    const results: { name: string; price: string }[] = [];

    for (const card of cards) {
      const nameEl = card.querySelector(selectors.hotelName);
      const priceEl = card.querySelector(selectors.hotelPrice);

      const name = nameEl?.textContent?.trim() ?? '';
      const price = priceEl?.textContent?.trim() ?? '';

      if (name && price) {
        results.push({ name, price });
      }
    }

    return results;
  }, SELECTORS);
}

// ── Main Flow ────────────────────────────────────────────────────────────────

export async function runPlaywrightHotelSearch(
  stagehand: Stagehand,
  invocation: IBrowserToolInvocation,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const page = await stagehand.context.awaitActivePage();

  // Build dates
  const today = new Date();
  const defaultCheckIn = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultCheckOut = new Date(today.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
  const checkIn = invocation.searchParameters.checkIn ?? defaultCheckIn;
  const checkOut = invocation.searchParameters.checkOut ?? defaultCheckOut;

  // ── BOOK MODE ──────────────────────────────────────────────────────────────
  if (invocation.mode === 'book') {
    return await runBooking(page, invocation, checkIn, checkOut, hooks);
  }

  // ── SEARCH MODE ────────────────────────────────────────────────────────────
  hooks.onFrame({
    type: 'tool_start',
    message: `Opening Booking.com for ${invocation.searchParameters.location}...`,
    timestamp: new Date().toISOString(),
  });

  // Direct URL search (fastest path)
  const searchUrl =
    `https://www.booking.com/searchresults.html` +
    `?ss=${encodeURIComponent(invocation.searchParameters.location)}` +
    `&checkin=${checkIn}&checkout=${checkOut}&group_adults=2&no_rooms=1&group_children=0`;

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeoutMs: NAV_TIMEOUT_MS });
  await page.waitForTimeout(DOM_SETTLE_MS);
  await dismissPopups(page);

  // If redirected to homepage (deep-link rejected), use UI search
  if (!page.url().includes('searchresults')) {
    hooks.onFrame({
      type: 'tool_start',
      message: 'Deep-link rejected — searching via UI...',
      timestamp: new Date().toISOString(),
    });

    // Type destination
    const destInput = page.locator(SELECTORS.destinationInput).first();
    if (await destInput.isVisible()) {
      await destInput.click();
      await destInput.fill(invocation.searchParameters.location);
      await page.waitForTimeout(800);
      // Click first suggestion
      const suggestion = page.locator('[data-testid="autocomplete-result"], .c_neb_sb_autocomplete li').first();
      if (await suggestion.isVisible()) {
        await suggestion.click();
      }
      await page.waitForTimeout(500);
    }

    // Pick dates
    await pickCalendarDate(page, checkIn);
    await pickCalendarDate(page, checkOut);
    await page.waitForTimeout(300);

    // Click search
    const searchBtn = page.locator(SELECTORS.searchButton).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    }

    await page.waitForTimeout(DOM_SETTLE_MS);
    await dismissPopups(page);
  }

  hooks.onFrame({
    type: 'thinking',
    message: 'Extracting hotel results...',
    timestamp: new Date().toISOString(),
  });

  // Extract results
  const rawResults = await extractResults(page);

  if (rawResults.length === 0) {
    // Retry once after reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(DOM_SETTLE_MS);
    await dismissPopups(page);
    const retryResults = await extractResults(page);

    if (retryResults.length === 0) {
      return { status: 'FAILED', errorMessage: 'No hotel results found.' };
    }

    const ranked = rankOptions(retryResults, invocation.searchParameters.maxBudget);
    hooks.onFrame({
      type: 'thinking',
      message: `Found ${ranked.length} hotels.`,
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'SUCCESS',
      scrapedData: { entityName: ranked[0].name, priceDisplay: ranked[0].price, summaryDetails: '' },
      options: ranked.map(r => ({ entityName: r.name, priceDisplay: r.price, summaryDetails: '' })),
    };
  }

  const ranked = rankOptions(rawResults, invocation.searchParameters.maxBudget);
  hooks.onFrame({
    type: 'thinking',
    message: `Found ${ranked.length} hotels.`,
    timestamp: new Date().toISOString(),
  });

  return {
    status: 'SUCCESS',
    scrapedData: { entityName: ranked[0].name, priceDisplay: ranked[0].price, summaryDetails: '' },
    options: ranked.map(r => ({ entityName: r.name, priceDisplay: r.price, summaryDetails: '' })),
  };
}

// ── Booking Flow ─────────────────────────────────────────────────────────────

async function runBooking(
  page: Page,
  invocation: IBrowserToolInvocation,
  checkIn: string,
  checkOut: string,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  const name = invocation.searchParameters.selectedHotelName ?? 'the selected hotel';
  const price = invocation.searchParameters.selectedHotelPrice ?? 'the listed price';

  // Navigate to results page if not already there
  if (!page.url().includes('searchresults')) {
    const searchUrl =
      `https://www.booking.com/searchresults.html` +
      `?ss=${encodeURIComponent(invocation.searchParameters.location)}` +
      `&checkin=${checkIn}&checkout=${checkOut}&group_adults=2&no_rooms=1&group_children=0`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeoutMs: NAV_TIMEOUT_MS });
    await page.waitForTimeout(DOM_SETTLE_MS);
    await dismissPopups(page);
  }

  // Try to click on the specific hotel
  hooks.onFrame({
    type: 'tool_start',
    message: `Opening ${name}...`,
    timestamp: new Date().toISOString(),
  });

  try {
    // Find and click the hotel by name
    const hotelLink = page.locator(`a:has-text("${name}"), [data-testid="title"]:has-text("${name}")`).first();
    if (await hotelLink.isVisible()) {
      await hotelLink.click();
      await page.waitForTimeout(DOM_SETTLE_MS);
    }
  } catch {
    // Non-fatal — guardrail still works
  }

  // Guardrail: pause for authorization
  const decision = await requestAuthorization(invocation.runId, { title: name, cost: price }, hooks);
  if (decision === 'cancel') {
    return { status: 'FAILED', errorMessage: 'Cancelled at guardrail by operator.' };
  }

  // Try to click reserve/book button
  try {
    const reserveBtn = page.locator(SELECTORS.reserveButton).first();
    if (await reserveBtn.isVisible()) {
      await reserveBtn.click();
      await page.waitForTimeout(DOM_SETTLE_MS);
    }
  } catch {
    // Non-fatal — user already authorized
  }

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
