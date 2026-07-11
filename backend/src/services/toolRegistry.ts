// PERSON A — Tool Registry
// Central registry mapping agent slugs → Anthropic tool definitions.
// Each agent gets the tools it needs. The LLM client loads them dynamically.
import type Anthropic from '@anthropic-ai/sdk';

// ── Flight Booker tools ───────────────────────────────────────────────────
const FLIGHT_BOOKER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_flights',
    description:
      'Search for flights from an origin to a destination. Returns a list of matching flights with airlines, prices, stops, and durations. The "location" param is the ORIGIN city; the DESTINATION must go in the preferences array as "destination:<city>".',
    input_schema: {
      type: 'object' as const,
      properties: {
        location: {
          type: 'string',
          description: 'The DEPARTURE/origin city or airport — NOT the destination. Example: "Seattle" or "SFO"',
        },
        checkIn: {
          type: 'string',
          description: 'Departure date in YYYY-MM-DD format',
        },
        checkOut: {
          type: 'string',
          description: 'Return date in YYYY-MM-DD format (omit for one-way)',
        },
        maxBudget: {
          type: 'number',
          description: 'Maximum ticket price in USD',
        },
        preferences: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Flight preferences. IMPORTANT: the destination city MUST be included here as "destination:<city>" (e.g. "destination:New York"). Also encode passengers as "passengers:<n>" and cabin class as "cabin:<economy|business|first>". Other strings are airline or time preferences.',
        },
      },
      required: ['location', 'maxBudget'],
    },
  },
  {
    name: 'book_flight',
    description:
      'Book a specific flight. This action involves spending money and REQUIRES user confirmation before finalizing. Pass the flight name as "hotelName" and the price as "price" (these fields are repurposed from the shared tool schema).',
    input_schema: {
      type: 'object' as const,
      properties: {
        hotelName: {
          type: 'string',
          description: 'The flight to book — use the exact airline + flight number from search results (e.g. "United Airlines — UA 241")',
        },
        price: {
          type: 'string',
          description: 'Ticket price per person (e.g. "$312")',
        },
        totalPrice: {
          type: 'string',
          description: 'Total cost for all passengers (e.g. "$624 for 2 passengers")',
        },
        checkIn: {
          type: 'string',
          description: 'Departure date in YYYY-MM-DD format',
        },
        checkOut: {
          type: 'string',
          description: 'Return date in YYYY-MM-DD format (omit for one-way)',
        },
        roomType: {
          type: 'string',
          description: 'Cabin class selected (e.g. "Economy", "Business", "First")',
        },
      },
      required: ['hotelName', 'price'],
    },
  },
];

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

// ── Grocery Runner tools ──────────────────────────────────────────────────
const GROCERY_RUNNER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'finalize_shopping_list',
    description:
      'Locks in the curated shopping list after the interview. Call this once you have enough information ' +
      '(from the user, Information Commons, or episodic memory) to propose a complete list and the user has ' +
      'approved it. This does NOT search any store yet — it only persists the list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          description: 'The finalized list of grocery items.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Item name (e.g. "whole milk", "chicken breast")' },
              quantity: { type: 'number', description: 'How many/much to buy (e.g. 2 for "2 gallons of milk")' },
              unit: { type: 'string', description: 'Optional unit hint (e.g. "gallon", "lb", "count")' },
              constraints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Per-item constraints (e.g. "organic", "lactose-free", "store brand ok")',
              },
            },
            required: ['name', 'quantity'],
          },
        },
        budget: { type: 'number', description: 'Optional total budget in USD for the whole trip.' },
      },
      required: ['items'],
    },
  },
  {
    name: 'generate_grocery_report',
    description:
      'Generates the priced, illustrated grocery report for the finalized list. Walmart, Costco, and Whole ' +
      'Foods have no public API, so there is no live price data — instead, estimate a realistic U.S. grocery ' +
      'price and package size for each item from your own general knowledge, plus a short store recommendation ' +
      'and a few related meal ideas. Call this only after finalize_shopping_list, and only once per shopping list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          description: 'One entry per finalized shopping-list item, enriched with an estimate.',
          items: {
            type: 'object',
            properties: {
              itemName: { type: 'string', description: 'Display title, e.g. "Canned Pinto Beans"' },
              imageQuery: {
                type: 'string',
                description: 'Short, generic search term for a stock photo of this exact product, e.g. "canned pinto beans"',
              },
              estimatedPrice: { type: 'number', description: 'Realistic estimated U.S. price in USD, e.g. 1.99' },
              sizeDisplay: { type: 'string', description: 'Typical package size/weight, e.g. "16 oz", "1 gal", "12 ct"' },
            },
            required: ['itemName', 'imageQuery', 'estimatedPrice'],
          },
        },
        bestStores: {
          type: 'array',
          items: { type: 'string' },
          description: 'General recommendation of which real-world chains suit this list best, e.g. ["Costco", "Walmart"]',
        },
        relatedMeals: {
          type: 'array',
          items: { type: 'string' },
          description: 'A few related recipe ideas the user might also enjoy, e.g. ["Quesadillas", "Chalupas"]',
        },
        tripTheme: { type: 'string', description: 'Short headline for the trip, e.g. "Taco Night"' },
        narrative: {
          type: 'string',
          description: 'One or two fun, first-person sentences summarizing the trip for a "fun facts" section.',
        },
      },
      required: ['items', 'bestStores', 'relatedMeals'],
    },
  },
];

// ── Registry ──────────────────────────────────────────────────────────────
// Add new agents here as they are developed. Shared tools can be referenced
// from multiple agents (e.g. search_hotels is used by both hotel-booker and
// travel-concierge).
const REGISTRY: Record<string, Anthropic.Tool[]> = {
  'hotel-booker': HOTEL_BOOKER_TOOLS,
  'grocery-runner': GROCERY_RUNNER_TOOLS,
  'flight-booker': FLIGHT_BOOKER_TOOLS,

  // Phase 4 — these will be populated when we scale to other agents
  // 'finance-ledger': FINANCE_LEDGER_TOOLS,
  // 'mom-scheduler': MOM_SCHEDULER_TOOLS,
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
