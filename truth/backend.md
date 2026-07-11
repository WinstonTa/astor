# Backend.md: Backend Architecture & 2-Person Work Distribution

> Companion to [plan.md](plan.md). The frontend lives in `frontend/` and is already built.
> Everything in this document lives in `backend/`. The GitHub process that glues the two
> developers together is defined in [github.md](github.md).

---

## 1. Backend Scope

The backend is a single Node.js/TypeScript service (deployed on a DigitalOcean droplet) that:

1. Accepts agent run requests from the frontend (`POST`).
2. Hydrates LLM context from PostgreSQL + pgvector (Information Commons + episodic memory).
3. Runs the LLM tool-calling loop.
4. Executes browser automation through Browserbase (headless Chrome over CDP).
5. Streams telemetry frames back to the frontend over SSE.
6. Pauses at the Guardrail Interlock before any state-changing transaction and waits for
   user authorization via webhook.
7. Writes an episodic memory embedding after every completed run.

---

## 2. Runtime Architecture

```
                        frontend/ (React, already built)
                              │                ▲
              POST /api/agent/run             │ GET /api/agent/stream/:runId (SSE)
              POST /api/agent/confirm         │
                              ▼                │
┌────────────────────────────────────────────────────────────────────────────────┐
│ backend/ — Express/Fastify service (single deployable)                         │
│                                                                                │
│  ┌──────────────────────────── LAYER 1: API GATEWAY ────────────────────────┐  │
│  │  routes/runRoutes.ts        POST /api/agent/run        → creates runId   │  │
│  │  routes/streamRoutes.ts     GET  /api/agent/stream/:id → opens SSE line  │  │
│  │  routes/confirmRoutes.ts    POST /api/agent/confirm    → unblocks guard  │  │
│  │  routes/commonsRoutes.ts    GET/PUT /api/commons       → shared prefs UI │  │
│  └───────────────────────────────────┬───────────────────────────────────────┘  │
│                                      │                                         │
│  ┌──────────────────── LAYER 2: ORCHESTRATOR ENGINE ─────────────────────────┐ │
│  │  services/orchestrator.ts   Run lifecycle state machine:                  │ │
│  │    QUEUED → HYDRATING → THINKING → EXECUTING_TOOL →                       │ │
│  │    AWAITING_CONFIRMATION → FINALIZING → COMPLETE | FAILED | CANCELLED     │ │
│  │  services/contextCompiler.ts  Merges Commons + episodic memory → prompt   │ │
│  │  services/llmClient.ts        Anthropic API tool-calling loop             │ │
│  │  services/sseManager.ts       runId → open SSE connections registry       │ │
│  │  services/memoryWriter.ts     Post-run summary → embedding → pgvector     │ │
│  └───────────────────────────────────┬───────────────────────────────────────┘ │
│                                      │  calls ONLY via contracts/ interfaces   │
│  ┌──────────────────── LAYER 3: TOOL EXECUTION RUNTIME ──────────────────────┐ │
│  │  tools/browserCore.ts       Browserbase session create/attach/teardown    │ │
│  │  tools/expediaMacro.ts      Playwright navigation + scrape + form-fill    │ │
│  │  tools/guardrails.ts        Interlock: pause-before-purchase engine       │ │
│  │  tools/screenshotter.ts     Frame capture → viewport_update telemetry     │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
                │                          │                        │
                ▼                          ▼                        ▼
      ┌──────────────────┐      ┌────────────────────┐    ┌──────────────────┐
      │ POSTGRESQL       │      │ PGVECTOR           │    │ BROWSERBASE      │
      │ users, agents,   │      │ commons_facts,     │    │ headless Chrome, │
      │ runs, run_events │      │ episodic_memories  │    │ cookie contexts  │
      └──────────────────┘      └────────────────────┘    └──────────────────┘
```

---

## 3. Database Schema (owned by Person A)

```sql
-- Identity & agent registry
users              (id, email, display_name, created_at)
agents             (id, slug, name, purpose, tool_manifest JSONB, created_at)

-- Run tracking (drives the SSE stream and the guardrail interlock)
runs               (id UUID, user_id, agent_id, prompt TEXT,
                    status TEXT,               -- state machine enum from Layer 2
                    guardrail_payload JSONB,   -- what needs confirming, if paused
                    browserbase_session_id TEXT,
                    created_at, updated_at)
run_events         (id, run_id, type TEXT, message TEXT, payload JSONB, created_at)
                    -- append-only mirror of every ITelemetryFrame, enables
                    -- SSE replay when a client reconnects (Last-Event-ID)

-- The Information Commons (cross-agent shared context)
commons_facts      (id, user_id, fact TEXT, embedding vector(1536),
                    category TEXT, updated_at)

-- Isolated per-agent episodic memory
episodic_memories  (id, user_id, agent_id, summary TEXT, embedding vector(1536),
                    run_id, created_at)
                    -- STRICT ISOLATION RULE: every query MUST filter by
                    -- (user_id, agent_id). No cross-agent reads, ever.

-- Browserbase cookie vault mapping
browser_contexts   (id, user_id, site TEXT, browserbase_context_id TEXT, updated_at)
```

---

## 4. API Surface (owned by Person A)

| Method | Route                        | Purpose                                            |
| ------ | ---------------------------- | -------------------------------------------------- |
| POST   | `/api/agent/run`             | Body: `{agentId, prompt}` → `{runId}`; kicks off the orchestrator loop asynchronously |
| GET    | `/api/agent/stream/:runId`   | SSE. Emits `ITelemetryFrame` events; supports `Last-Event-ID` replay from `run_events` |
| POST   | `/api/agent/confirm`         | Body: `{runId, decision: 'authorize' \| 'cancel'}` → resolves the guardrail promise |
| GET    | `/api/agents`                | Agent registry for the marketplace grid            |
| GET    | `/api/commons`               | List the user's Information Commons facts          |
| PUT    | `/api/commons/:factId`       | Edit/delete a shared preference                    |

The SSE wire format is exactly `ITelemetryFrame` from `contracts/streamContract.ts`
(defined in plan.md §4) — one frame per `data:` line, `id:` set to the `run_events` row id.

---

## 5. The Guardrail Interlock Mechanics (owned by Person B)

The pause is implemented as a **promise held open inside the run's execution thread**:

1. `expediaMacro.ts` reaches the final purchase button and instead of clicking, calls
   `guardrails.requestAuthorization(runId, payload)`.
2. `guardrails.ts` flips the run row to `AWAITING_CONFIRMATION`, emits an
   `action_required` telemetry frame, and returns an unresolved `Promise<Decision>`.
3. The worker awaits that promise. Nothing else runs for this runId.
4. When `POST /api/agent/confirm` arrives (Person A's route), it calls
   `guardrails.resolveAuthorization(runId, decision)` — the only cross-boundary call
   in that direction, and it goes through `contracts/guardrailContract.ts`.
5. On `authorize` → macro clicks confirm, scrapes the receipt, returns
   `IToolExecutionResult{status:'SUCCESS'}`. On `cancel` → macro aborts the session
   and returns `status:'FAILED'` with a user-cancelled reason.
6. A 10-minute timeout auto-cancels and releases the Browserbase session.

---

## 6. Contracts (frozen Day 1, shared directory)

`backend/src/contracts/` extends the two interfaces in plan.md §4 with one more:

```typescript
// backend/src/contracts/guardrailContract.ts
export type GuardrailDecision = 'authorize' | 'cancel';

export interface IGuardrailBridge {
  // Person B implements; Person A calls from confirmRoutes.ts
  resolveAuthorization(runId: string, decision: GuardrailDecision): boolean;

  // Person B calls internally; emits frames through Person A's sseManager
  // via the onFrame callback injected at run start (see IRunHooks below)
}

// backend/src/contracts/runHooks.ts
export interface IRunHooks {
  // Person A implements and injects into Person B's executor at invocation time.
  // This is how Person B's tool layer streams telemetry WITHOUT importing
  // Person A's sseManager directly.
  onFrame(frame: ITelemetryFrame): void;
}
```

**Dependency direction rule:** Person B's `tools/` never imports from Person A's
`services/` and vice versa. Both import only from `contracts/`. Person A passes
callbacks (hooks) down; Person B returns results up. This is a hard software firewall.

---

## 7. Directory Tree & Ownership

```
backend/
├── package.json                 # SHARED — created Day 0 together, then locked
├── tsconfig.json                # SHARED — Day 0, then locked
├── .env.example                 # SHARED — Day 0 (keys: DATABASE_URL, ANTHROPIC_API_KEY,
│                                #          BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID)
├── src/
│   ├── index.ts                 # PERSON A (server bootstrap, route mounting)
│   ├── contracts/               # SHARED — written Day 1 pair session, then FROZEN
│   │   ├── toolContract.ts
│   │   ├── streamContract.ts
│   │   ├── guardrailContract.ts
│   │   └── runHooks.ts
│   ├── routes/                  # PERSON A exclusive
│   ├── services/                # PERSON A exclusive
│   │   ├── database.ts
│   │   ├── orchestrator.ts
│   │   ├── contextCompiler.ts
│   │   ├── llmClient.ts
│   │   ├── sseManager.ts
│   │   └── memoryWriter.ts
│   ├── tools/                   # PERSON B exclusive
│   │   ├── browserCore.ts
│   │   ├── expediaMacro.ts
│   │   ├── guardrails.ts
│   │   ├── screenshotter.ts
│   │   └── __mocks__/           # PERSON B's local test harness
│   └── db/
│       └── migrations/          # PERSON A exclusive
└── tests/
    ├── services/                # PERSON A
    └── tools/                   # PERSON B
```

---

## 8. Person A — "The Orchestrator" (data in, streams out)

| # | Deliverable | Details |
| - | ----------- | ------- |
| A1 | DB migrations + `database.ts` | All tables in §3, pgvector similarity queries for Commons + episodic recall (top-k, filtered by user_id/agent_id) |
| A2 | API gateway | All routes in §4, request validation, run creation |
| A3 | `sseManager.ts` | Connection registry keyed by runId, heartbeat every 25s, `Last-Event-ID` replay from `run_events` |
| A4 | `contextCompiler.ts` | Prompt assembly: base agent script + Commons facts + episodic memories + user prompt |
| A5 | `llmClient.ts` + `orchestrator.ts` | Anthropic tool-calling loop, run state machine, calls Person B **only** through `IBrowserToolInvocation` |
| A6 | `memoryWriter.ts` | Post-run summarization → embedding → `episodic_memories` insert |
| A7 | **Mock tool executor** | Day 1: a fake `executeBrowserTask` that sleeps 3s and returns canned hotel data + emits fake frames through `IRunHooks`. Lets A finish the entire pipeline without B. |

## 9. Person B — "The Automation Runtime" (decisions in, actions out)

| # | Deliverable | Details |
| - | ----------- | ------- |
| B1 | `browserCore.ts` | Browserbase SDK session lifecycle: create with saved `browserbase_context_id`, attach Playwright over CDP, teardown/cleanup |
| B2 | `expediaMacro.ts` | Search navigation, result scraping (`entityName`, `priceDisplay`, `summaryDetails`), checkout form fill — stops before the confirm click |
| B3 | `guardrails.ts` | The interlock engine from §5: pending-promise registry, `resolveAuthorization`, 10-min timeout |
| B4 | `screenshotter.ts` | Periodic frame capture → `viewport_update` frames via injected `IRunHooks.onFrame` |
| B5 | **Mock run harness** | Day 1: a standalone script (`tools/__mocks__/localRun.ts`) that feeds hardcoded `IBrowserToolInvocation` payloads into the macro and prints frames to stdout. Lets B develop without A's server. |
| B6 | Error taxonomy | Selector-drift detection, retry-once policy, structured `errorMessage` values in `IToolExecutionResult` |

## 10. Integration Milestones

| Day | Event |
| --- | ----- |
| 0 | Pair session: scaffold `backend/`, write `package.json`, `tsconfig`, `.env.example`, and ALL contract files together. Merge to `main` as one PR. Contracts are now frozen. |
| 1–4 | Parallel work. A builds against the mock executor (A7); B builds against the mock harness (B5). Both merge to `main` continuously — see github.md. |
| 5 | **The Handshake:** A deletes the mock import and swaps in `import { executeBrowserTask } from '../tools/browserCore'`. One-line PR. End-to-end smoke test against a real Browserbase session. |
| 6 | Hardening: SSE reconnect replay, guardrail timeout paths, memory-write verification. |

**Contract change protocol:** if a contract file genuinely must change after Day 0,
it requires a PR that BOTH developers approve, and it must merge before any code
depending on the change. This is the only file class with a two-approval rule.
