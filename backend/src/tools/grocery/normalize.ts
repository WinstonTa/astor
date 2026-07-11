// Grocery Runner — pure price math. No LLM, no I/O.
// The estimated total shown in the report is computed here from the LLM's
// per-item price estimates rather than trusted from the LLM's own arithmetic.

/** "$4.99" / "4.99" / "$1,299.00" → 499 / 499 / 129900 (cents). Returns null if unparseable. */
export function parsePriceCents(priceDisplay: string): number | null {
  const match = priceDisplay.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[1]) * 100);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
