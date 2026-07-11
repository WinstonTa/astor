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
}
