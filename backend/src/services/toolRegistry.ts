// PERSON A — Tool Registry
// Central registry mapping agent slugs → Anthropic tool definitions.
// Each agent gets the tools it needs. The LLM client loads them dynamically.
import type Anthropic from '@anthropic-ai/sdk';

// ── Hotel Booker tools ────────────────────────────────────────────────────
const HOTEL_BOOKER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_hotels',
    description:
      'Search for hotels on a travel site. Returns a list of matching hotels with names, prices, ratings, and amenities. Use this first to find options before booking.',
    input_schema: {
      type: 'object' as const,
      properties: {
        location: {
          type: 'string',
          description: 'City, neighborhood, or area to search (e.g. "Seattle downtown", "Near LAX")',
        },
        checkIn: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format',
        },
        checkOut: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format',
        },
        maxBudget: {
          type: 'number',
          description: 'Maximum nightly rate in USD',
        },
        preferences: {
          type: 'array',
          items: { type: 'string' },
          description:
            'User preferences to filter by (e.g. "King bed", "pool", "Hilton Honors", "near downtown", "free breakfast")',
        },
      },
      required: ['location', 'maxBudget'],
    },
  },
  {
    name: 'book_hotel',
    description:
      'Book a specific hotel. This action involves spending money and REQUIRES user confirmation before finalizing. The system will pause and wait for authorization.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hotelName: {
          type: 'string',
          description: 'Exact name of the hotel to book',
        },
        price: {
          type: 'string',
          description: 'Price per night (e.g. "$185/night")',
        },
        totalPrice: {
          type: 'string',
          description: 'Total cost for the stay (e.g. "$370 for 2 nights")',
        },
        checkIn: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format',
        },
        checkOut: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format',
        },
        roomType: {
          type: 'string',
          description: 'Room type selected (e.g. "King Suite", "Standard Double")',
        },
      },
      required: ['hotelName', 'price'],
    },
  },
];

// ── Registry ──────────────────────────────────────────────────────────────
// Add new agents here as they are developed. Shared tools can be referenced
// from multiple agents (e.g. search_hotels is used by both hotel-booker and
// travel-concierge).
const REGISTRY: Record<string, Anthropic.Tool[]> = {
  'hotel-booker': HOTEL_BOOKER_TOOLS,

  // Phase 4 — these will be populated when we scale to other agents
  // 'finance-ledger': FINANCE_LEDGER_TOOLS,
  // 'mom-scheduler': MOM_SCHEDULER_TOOLS,
  // 'grocery-runner': GROCERY_RUNNER_TOOLS,
  // 'inbox-triage': INBOX_TRIAGE_TOOLS,
  // 'travel-concierge': [...TRAVEL_CONCILIARY_TOOLS, ...HOTEL_BOOKER_TOOLS],
};

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Get the Anthropic tool definitions for a given agent slug.
 * Returns an empty array if the agent has no tools registered.
 */
export function getToolsForAgent(slug: string): Anthropic.Tool[] {
  return REGISTRY[slug] ?? [];
}

/**
 * Check if a tool name is valid for a given agent.
 */
export function isValidToolForAgent(slug: string, toolName: string): boolean {
  const tools = REGISTRY[slug] ?? [];
  return tools.some((t) => t.name === toolName);
}

/**
 * Get all registered agent slugs.
 */
export function getRegisteredSlugs(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Get all unique tool names across all agents.
 */
export function getAllToolNames(): string[] {
  const names = new Set<string>();
  for (const tools of Object.values(REGISTRY)) {
    for (const tool of tools) {
      names.add(tool.name);
    }
  }
  return [...names];
}
