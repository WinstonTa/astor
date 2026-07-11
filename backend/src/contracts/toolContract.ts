// FROZEN — Day 0 contract. Changes require dual-approval PR.
export interface IBrowserToolInvocation {
  runId: string;
  targetUrl: string;
  browserbaseContextId: string;
  searchParameters: {
    location: string;
    maxBudget: number;
    preferences: string[];
    checkIn?: string;   // YYYY-MM-DD — optional, defaults handled downstream
    checkOut?: string;  // YYYY-MM-DD — optional, defaults handled downstream
  };
}

export interface IToolExecutionResult {
  status: 'SUCCESS' | 'GUARDRAIL_TRIGGERED' | 'FAILED';
  scrapedData?: {
    entityName: string;
    priceDisplay: string;
    summaryDetails: string;
  };
  errorMessage?: string;
}
