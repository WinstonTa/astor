# Person A — Remaining Work Plan

> After completing the backend scaffold (A1–A7) and frontend integration (Phase 1 + Phase 2),
> the next work is giving each agent its own **tools**, **skills**, and **personality**.
>
> We start with Hotel Booker as the template agent. Other agents follow the same pattern later.

---

## Current State

| Layer | Status | Problem |
|-------|--------|---------|
| Tool schemas (what the LLM sees) | ⚠️ Hardcoded | `llmClient.ts` has `search_hotels` + `book_hotels` hardcoded — works for Hotel Booker only |
| System prompt | ⚠️ Generic | `contextCompiler.ts` builds a generic prompt — no agent personality or specific instructions |
| Tool manifest in DB | ✅ Seeded | Each agent has a `tool_manifest` JSONB with tool name strings |
| Memory (episodic + commons) | ✅ Working | Per-agent isolation, semantic recall, post-run summarization |
| SSE streaming | ✅ Working | Live telemetry, heartbeat, replay |
| Orchestrator state machine | ✅ Working | Full lifecycle with mock tool executor |

---

## Phase 1: Hotel Booker — Tool Registry + Dynamic Loading

**Goal:** Make the LLM client load the right tools per agent instead of hardcoding.

### 1.1 Create tool registry
- **File:** `backend/src/services/toolRegistry.ts` (new)
- A central registry mapping agent slugs → Anthropic tool definitions
- Hotel Booker gets: `search_hotels`, `book_hotels`
- Each tool has: name, description, input_schema, and a metadata field linking to the execution function

```typescript
// Example structure
const TOOL_REGISTRY: Record<string, Anthropic.Tool[]> = {
  "hotel-booker": [
    { name: "search_hotels", description: "...", input_schema: { ... } },
    { name: "book_hotel", description: "...", input_schema: { ... } },
  ],
  // Other agents added in Phase 3
};

export function getToolsForAgent(slug: string): Anthropic.Tool[] {
  return TOOL_REGISTRY[slug] ?? [];
}
```

### 1.2 Update llmClient.ts to accept dynamic tools
- **File:** `backend/src/services/llmClient.ts` (modify)
- Remove hardcoded `BROWSER_TOOLS` constant
- `think()` and `continueWithToolResult()` accept a `tools` parameter
- The orchestrator passes `getToolsForAgent(agent.slug)` to the LLM client

### 1.3 Update orchestrator.ts to pass tools through
- **File:** `backend/src/services/orchestrator.ts` (modify)
- Load tools from registry at run start
- Pass to `think()` and `continueWithToolResult()`

### 1.4 Tests
- **File:** `backend/tests/services/toolRegistry.test.ts` (new)
- Test that Hotel Booker gets correct tools
- Test that unknown agents get empty tools
- Test tool schema validation

---

## Phase 2: Hotel Booker — Agent-Specific System Prompt

**Goal:** Give Hotel Booker a detailed personality, instructions, and constraints instead of a generic prompt.

### 2.1 Create agent prompt config
- **File:** `backend/src/services/agentPrompts.ts` (new)
- A config mapping agent slugs → detailed system prompts
- Hotel Booker prompt includes:
  - Role definition: "You are a Hotel Booker agent..."
  - Behavioral instructions: search strategy, price comparison, preference matching
  - Guardrail rules: ALWAYS ask before booking, show price breakdown
  - Output format: structured summaries after each step
  - Error handling: what to do when no hotels match, when budget is too low

```typescript
const AGENT_PROMPTS: Record<string, string> = {
  "hotel-booker": `You are Hotel Booker, an AI agent that finds and books hotels.

## Your Process
1. Ask clarifying questions if location, dates, or budget are unclear.
2. Search for hotels matching the user's criteria and saved preferences.
3. Present the top 3 options with prices, ratings, and key amenities.
4. Wait for the user to pick one (or let the LLM choose based on preferences).
5. Fill in booking details and STOP before clicking confirm.
6. Request explicit user authorization before finalizing any purchase.

## Rules
- NEVER complete a booking without user confirmation.
- Always check the Information Commons for loyalty programs and saved preferences.
- If no hotels match the budget, suggest alternatives (nearby dates, nearby areas).
- Present prices clearly: "$X/night, $Y total for Z nights".

## Available Tools
You can search for hotels and book them. Use search_hotels first, then book_hotel.`,
};
```

### 2.2 Update contextCompiler.ts to use agent-specific prompts
- **File:** `backend/src/services/contextCompiler.ts` (modify)
- `buildAgentSystemPrompt()` checks `AGENT_PROMPTS[slug]` first
- Falls back to the generic builder if no specific prompt exists
- The rest of the context assembly (Commons, episodic memory) stays the same

### 2.3 Tests
- **File:** `backend/tests/services/contextCompiler.test.ts` (update)
- Test that Hotel Booker gets the detailed prompt
- Test that Commons + episodic memory are still appended
- Test fallback for agents without specific prompts

---

## Phase 3: Hotel Booker — End-to-End Refinement

**Goal:** Polish the Hotel Booker experience before scaling to other agents.

### 3.1 Refine the mock tool executor for Hotel Booker
- **File:** `backend/src/services/mockToolExecutor.ts` (modify)
- Return more realistic hotel search results (3-5 options instead of 1)
- Include ratings, amenities, distance from city center
- Simulate the guardrail flow: return `GUARDRAIL_TRIGGERED` status for book_hotel

### 3.2 Improve the orchestrator tool-call loop
- **File:** `backend/src/services/orchestrator.ts` (modify)
- Support multi-turn tool conversations (search → present → user picks → book)
- Track tool call history in the messages array properly
- Handle the case where the LLM calls multiple tools in sequence

### 3.3 Update frontend for multi-step flows
- **File:** `frontend/src/components/TelemetryLog.tsx` (modify)
- Show richer telemetry for multi-step hotel booking
- Display search results as they come in from `viewport_update` frames

### 3.4 Seed realistic commons facts for testing
- **File:** `backend/src/db/migrations/002_seed_test_data.sql` (new)
- Create a test user with commons facts:
  - "Hilton Honors Gold member"
  - "Prefers King bed, non-smoking"
  - "Budget: typically $150-250/night"
  - "Home city: Seattle"

---

## Phase 4: Scale to Other Agents

**Goal:** Define tools, prompts, and mock executors for all 6 agents.

### 4.1 Finance Ledger
- Tools: `query_transactions`, `generate_report`, `set_budget_alert`
- Prompt: "You are Finance Ledger, an AI agent that tracks spending..."
- Mock executor: returns fake transaction data and budget summaries

### 4.2 Mom Scheduler
- Tools: `check_calendar`, `create_event`, `send_reminder`
- Prompt: "You are Mom Scheduler, an AI agent that manages family logistics..."
- Mock executor: returns fake calendar events and creates new ones

### 4.3 Grocery Runner
- Tools: `search_groceries`, `add_to_cart`, `place_order`
- Prompt: "You are Grocery Runner, an AI agent that orders groceries..."
- Mock executor: returns fake grocery results and cart data

### 4.4 Inbox Triage
- Tools: `read_emails`, `draft_reply`, `categorize_email`
- Prompt: "You are Inbox Triage, an AI agent that manages your inbox..."
- Mock executor: returns fake email data and draft replies

### 4.5 Travel Concierge
- Tools: `search_flights`, `search_hotels`, `create_itinerary`, `book_flight`
- Prompt: "You are Travel Concierge, an AI agent that plans trips..."
- Mock executor: returns fake flight and itinerary data
- NOTE: shares `search_hotels` tool with Hotel Booker — tool registry handles dedup

### 4.6 Update toolRegistry.ts with all agents
- Each agent slug maps to its tool definitions
- Shared tools (like `search_hotels`) are defined once and referenced

### 4.7 Update contextCompiler.ts with all prompts
- Each agent gets a detailed system prompt
- Generic fallback remains for any agent without a specific prompt

---

## Phase 5: Tool Execution Layer (connects to Person B)

**Goal:** Wire tool calls to real execution functions instead of mocks.

### 5.1 Define the tool executor interface
- **File:** `backend/src/contracts/toolContract.ts` (extend)
- Each tool name maps to an execution function signature
- The orchestrator dispatches tool calls to the right executor

### 5.2 Hotel Booker execution (Person B delivers)
- `search_hotels` → `tools/browserCore.ts` → Browserbase + Expedia macro
- `book_hotel` → `tools/guardrails.ts` → pause before purchase

### 5.3 Other agent execution (future)
- Finance Ledger → API calls to financial data providers
- Mom Scheduler → Calendar API integration
- Grocery Runner → Browser automation for grocery sites
- Inbox Triage → Email API integration
- Travel Concierge → Flight/hotel API + browser automation

### 5.4 The Day 5 Handshake
- Swap `mockToolExecutor` → `tools/browserCore` in orchestrator.ts
- One-line import change
- End-to-end smoke test against real Browserbase session

---

## Execution Order

```
Phase 1 (tool registry + dynamic loading)
  ↓
Phase 2 (Hotel Booker system prompt)
  ↓
Phase 3 (refine mock + multi-turn loop + seed data)
  ↓
Phase 4 (scale to all 6 agents)
  ↓
Phase 5 (wire to real execution — needs Person B)
```

**Phases 1–3 are Person A only (can start now).**
**Phase 4 is Person A only (after Phase 3).**
**Phase 5 requires Person B to finish their deliverables.**

---

## File Change Summary

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| 1 | `services/toolRegistry.ts`, `tests/toolRegistry.test.ts` | `services/llmClient.ts`, `services/orchestrator.ts` |
| 2 | `services/agentPrompts.ts` | `services/contextCompiler.ts`, `tests/contextCompiler.test.ts` |
| 3 | `db/migrations/002_seed_test_data.sql` | `services/mockToolExecutor.ts`, `services/orchestrator.ts` |
| 4 | — | `services/toolRegistry.ts`, `services/agentPrompts.ts`, `services/mockToolExecutor.ts` |
| 5 | — | `services/orchestrator.ts` (one-line swap) |
