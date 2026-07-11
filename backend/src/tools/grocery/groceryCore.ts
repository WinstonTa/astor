// Grocery Runner — domain entrypoint. No live browser automation: Walmart,
// Costco, and Whole Foods have no public APIs and reliably block automated
// scraping. Instead, the LLM proposes an estimated, priced shopping list from
// its own knowledge; this module resolves a generic stock photo per item and
// computes the authoritative total, producing a report the frontend renders
// as a standalone webpage instead of a live browser view.
import type { IRunHooks } from '../../contracts/runHooks.js';
import type {
  IShoppingListItem,
  IToolExecutionResult,
  IGroceryReport,
  IGroceryReportItem,
} from '../../contracts/toolContract.js';
import { createShoppingList } from '../../services/database.js';
import { resolveItemImage } from './imageFetch.js';
import { formatCents } from './normalize.js';

// ── Phase 1: finalize (no browser) ─────────────────────────────────────────
export async function finalizeShoppingList(
  userId: string,
  runId: string,
  items: IShoppingListItem[],
  budgetCents?: number,
): Promise<IToolExecutionResult> {
  if (items.length === 0) {
    return { status: 'FAILED', errorMessage: 'Cannot finalize an empty shopping list.' };
  }
  await createShoppingList(userId, runId, items, budgetCents);
  return { status: 'SUCCESS' };
}

// ── Phase 2: generate the priced, illustrated report ───────────────────────
export interface ReportItemInput {
  itemName: string;
  imageQuery: string;
  estimatedPrice: number; // USD, e.g. 1.99
  sizeDisplay?: string;
}

export interface GenerateReportInput {
  items: ReportItemInput[];
  bestStores: string[];
  relatedMeals: string[];
  tripTheme?: string;
  narrative?: string;
}

export async function generateGroceryReport(
  input: GenerateReportInput,
  hooks: IRunHooks,
): Promise<IToolExecutionResult> {
  if (!input.items || input.items.length === 0) {
    return { status: 'FAILED', errorMessage: 'generate_grocery_report requires at least one item.' };
  }

  hooks.onFrame({
    type: 'thinking',
    message: `Building your grocery report — sourcing photos for ${input.items.length} item(s)...`,
    timestamp: new Date().toISOString(),
  });

  const items: IGroceryReportItem[] = await Promise.all(
    input.items.map(async (item) => ({
      itemName: item.itemName,
      imageUrl: await resolveItemImage(item.imageQuery || item.itemName),
      estimatedPriceDisplay: formatCents(Math.round((item.estimatedPrice || 0) * 100)),
      sizeDisplay: item.sizeDisplay,
    })),
  );

  // Total is computed here, not trusted from the LLM's own arithmetic —
  // the same "accuracy lives in code" principle as the rest of this agent.
  const totalCents = input.items.reduce((sum, item) => {
    const cents = Math.round((item.estimatedPrice || 0) * 100);
    return sum + (Number.isFinite(cents) ? cents : 0);
  }, 0);

  const report: IGroceryReport = {
    tripTheme: input.tripTheme,
    items,
    estimatedTotalDisplay: formatCents(totalCents),
    bestStores: input.bestStores?.length ? input.bestStores : ['Walmart', 'Costco', 'Whole Foods'],
    relatedMeals: input.relatedMeals ?? [],
    narrative: input.narrative,
  };

  // Emitted directly (not just returned) so the frontend's report webpage can
  // pick it up from the SSE stream the moment it's ready, independent of the
  // LLM's own text turn.
  hooks.onFrame({
    type: 'tool_start',
    message: 'Grocery report ready.',
    timestamp: new Date().toISOString(),
    payload: { groceryReport: report },
  });

  return { status: 'SUCCESS', groceryReport: report };
}
