// FROZEN — Day 0 contract. Additive optional fields only; changes require dual-approval PR.
export interface IBrowserToolInvocation {
  runId: string;
  targetUrl: string;
  browserbaseContextId: string;
  // 'search' (default) only finds+returns options — it NEVER books. 'book' runs the
  // purchase guardrail + checkout for `selectedHotelName`. Additive; older callers
  // that omit it get search behaviour, which is the safe default.
  mode?: 'search' | 'book';
  searchParameters: {
    location: string;
    maxBudget: number;
    preferences: string[];
    checkIn?: string;   // YYYY-MM-DD — optional, defaults handled downstream
    checkOut?: string;  // YYYY-MM-DD — optional, defaults handled downstream
    selectedHotelName?: string;  // required for mode: 'book' — the hotel the user authorized
    selectedHotelPrice?: string; // display price for the confirmation card (from the search)
  };
}

export interface IHotelOption {
  entityName: string;
  priceDisplay: string;
  summaryDetails: string;
}

export interface IToolExecutionResult {
  status: 'SUCCESS' | 'GUARDRAIL_TRIGGERED' | 'FAILED';
  scrapedData?: IHotelOption;
  // Populated by a 'search' run: the full ranked list, so the LLM (not opaque code)
  // presents the choices and recommends the single best one before any booking.
  options?: IHotelOption[];
  errorMessage?: string;
  // ── Grocery domain (additive, Person A) ─────────────────────────────────
  groceryReport?: IGroceryReport;
}

// ── Grocery domain types (additive — no existing interface above is modified) ──
// Walmart, Costco, and Whole Foods have no public APIs and reliably block
// automated scraping, so there is no live per-store price data. Instead the
// LLM proposes an estimated, priced list from its own knowledge, and the
// result is rendered as a standalone "grocery report" (see IGroceryReport)
// instead of driving a real browser.
export interface IShoppingListItem {
  name: string;
  quantity: number;
  unit?: string;
  constraints?: string[]; // e.g. "organic", "lactose-free", "store brand ok"
}

export interface IGroceryReportItem {
  itemName: string;             // display title, e.g. "Canned Pinto Beans"
  imageUrl: string;             // resolved generic stock photo (or a generated placeholder)
  estimatedPriceDisplay: string; // "$1.99"
  sizeDisplay?: string;          // "16 oz"
}

export interface IGroceryReport {
  tripTheme?: string;           // short headline, e.g. "Taco Night"
  items: IGroceryReportItem[];
  estimatedTotalDisplay: string; // computed server-side from item prices, not LLM math
  bestStores: string[];         // general recommendation, e.g. ["Costco", "Walmart", "Kroger"]
  relatedMeals: string[];       // e.g. ["Quesadillas", "Chalupas"]
  narrative?: string;           // LLM's short first-person "fun facts" blurb
}
