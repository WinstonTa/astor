# Plan.md: AI Agent Marketplace Platform Blueprint

## 1. Executive Product Vision

A modular marketplace where AI agents are represented as smartphone-style app boxes. Each agent is specialized for a distinct category of workflows (e.g., Hotel Booker, Finance Planner, Mom-Scheduler) with access to its own unique tools and localized episodic memories.

### The Balancing Core Engine

* **Strict Isolation:** Agent scripts, tool accessibility rules, and long-term memories are logically separated so no context or cross-tenant bleed occurs.
* **Information Commons:** A unified data tier containing cross-agent user context (profiles, preferences, schedules, lifestyle metrics). Any agent invoked by a user hydrates its prompt with these shared preferences.

---

## 2. Complete End-to-End System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                    FRONTEND CLIENT                     │
                    │   - Grid Canvas Dashboard of Agent App Cards           │
                    │   - Streaming Log Component & Viewport Frame           │
                    └───────────────────┬────────────────────▲───────────────┘
                                        │                    │
                HTTP POST (Trigger Run) │                    │ HTTP GET / SSE Stream
                                        ▼                    │ (Real-Time UI Updates)
 ┌───────────────────────────────────────────────────────────┴────────────────────────────────────────────────┐
 │ DIGITALOCEAN DROPLET RUNTIME (VPC Cloud Instance)                                                          │
 │                                                                                                            │
 │  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
 │  │ 1. API GATEWAY & ROUTING LAYER                                                                       │  │
 │  │    - Exposes transactional REST endpoints and initializes long-lived unidirectional SSE lines.       │  │
 │  └───────────────────────────────────┬──────────────────────────────────────────────────────────────────┘  │
 │                                      │                                                                     │
 │                                      ▼                                                                     │
 │  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
 │  │ 2. CORE AGENT ORCHESTRATOR ENGINE                                                                    │  │
 │  │    - Fetches user context, coordinates message payload hydration, interfaces with LLM inference layer.│  │
 │  └───────────────────────────────────┬──────────────────────────────────────────────────────────────────┘  │
 │                                      │                                                                     │
 │                                      ▼                                                                     │
 │  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
 │  │ 3. DECOUPLED TOOL EXECUTION ROUTER                                                                   │  │
 │  │    - Intercepts LLM tool calls and executes downstream browser or API automation engines natively.   │  │
 │  └───────────────────────────────────┬──────────────────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Secure CDP Protocol (Chrome DevTools Protocol) Over TLS
                                        ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ CLOUD DATA STORAGE & RUNTIMES                                                                              │
 │                                                                                                            │
 │  ┌─────────────────────────────────┐ ┌─────────────────────────────────┐ ┌──────────────────────────────┐  │
 │  │      POSTGRESQL RELATIONAL      │ │      PGVECTOR EMBEDDING STORE   │ │  BROWSERBASE INFRASTRUCTURE  │  │
 │  │  - Agent Schemas & Tool Specs   │ │  - Global "Information Commons" │ │  - Headless Chrome Pods      │  │
 │  │  - Browserbase Session Mappings │ │  - Isolated Episodic Memories   │ │  - User Session Cookie Vault │  │
 │  └─────────────────────────────────┘ └─────────────────────────────────┘ └──────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

```

### Data Pipeline & Execution Steps (The Hotel Booking Template)

1. **Ingestion:** User submits a prompt (*"Book a hotel in Seattle under $200"*) through the target UI box. The request registers an explicit execution tracking session ID.
2. **Context Hydration:** The backend queries the Postgres/pgvector instance to pull two data profiles:
* *Global Persona (Information Commons):* Shared user preferences (*"Hilton Honors Member, prefers King beds"*).
* *Local Memory:* Isolated agent history (*"Avoid Airport locations due to past noise complaints"*).


3. **Inference:** The system appends these details to the base tool configuration and triggers the LLM. The LLM processes the instructions and responds with a structured tool call schema requesting browser navigation.
4. **Browser Execution:** The runtime connects over secure protocols to the **Browserbase Cloud**. Browserbase loads a headless Chrome container preloaded with the user's authentic session cookies for Expedia, allowing the agent to perform actions as the natively logged-in user.
5. **Streaming Feedback Loop:** Real-time progress indicators, operational summaries, and canvas-rendered visual frames from Browserbase stream backward via a unidirectional **Server-Sent Events (SSE)** channel straight onto the user's UI dashboard.
6. **The Transaction Interlock (Guardrail):** When the agent locates a target hotel and fills out checkout fields, the Orchestrator blocks execution directly before clicking the absolute confirmation element. The system updates its operational state to `AWAITING_CONFIRMATION` and pushes an approval card module down the SSE stream to the frontend. The worker thread rests until the user provides a signed confirmation callback via an HTTP `POST` webhook.
7. **Episodic Memory Update:** Following successful execution, a summary string of the completed transaction is embedded into a vector matrix and written to the pgvector table under the user's specific agent index for future lookups.

---

## 3. Strict Task Subdivision (2-Developer Split)

To maintain absolute independence and completely eliminate merge conflicts, the system is split horizontally by **Data Flow Boundaries** rather than structural tech layers.

### Person A: The Architect & Orchestrator

Person A owns the intake gateway, database management, LLM context formatting, and the outbound delivery channels back to the frontend.

* **Database Foundations:** Provisioning the PostgreSQL tables and writing vector queries (pgvector) to extract the Information Commons text strings and localized episodic memories.
* **The Streaming Router:** Building the transactional API endpoint inputs along with the persistent `GET /api/agent/stream` route to feed execution text packets downward.
* **Context Compiler:** Code that accepts incoming tasks, hydrates the underlying data arrays, and builds the unified conversation payload sent to the LLM interface layer.

### Person B: The Automation & Runtime Master

Person B owns what happens *inside* the execution runtime once the LLM makes a decision, including all browser handling, scripting, and guardrails.

* **Browserbase Integration:** Writing the underlying framework connector scripts that securely establish sessions via the Browserbase SDK using saved profile contexts.
* **Automation Drivers:** Designing the Playwright/Puppeteer automation macros responsible for navigating Expedia components, executing field inputs, and extracting scraped target attributes.
* **The Guardrail Interlock Engine:** Creating the interception handlers that monitor browser automation lines, pause active threads precisely before state-changing transactions occur, and evaluate unblocking commands from the network interface.

---

## 4. Integration Boundaries: Code Contracts

To prevent communication breakdowns, Person A and Person B interact purely through two rigid, pre-defined TypeScript interfaces. These function as a software firewall between their tasks.

### Contract 1: The Tool Execution Signal

When Person A's orchestrator needs Person B's automation scripts to fire, they must invoke Person B's module using *only* this strict data model:

```typescript
// Location: src/contracts/toolContract.ts
export interface IBrowserToolInvocation {
  runId: string;
  targetUrl: string;
  browserbaseContextId: string;
  searchParameters: {
    location: string;
    maxBudget: number;
    preferences: string[]; // Pulled dynamically from Information Commons
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

```

### Contract 2: The Downstream Streaming Payload

Both developers must pass live data structures to the user using the same standardized telemetry frame schema:

```typescript
// Location: src/contracts/streamContract.ts
export interface ITelemetryFrame {
  type: 'thinking' | 'tool_start' | 'viewport_update' | 'action_required' | 'complete';
  message: string;
  timestamp: string;
  payload?: {
    screenshotUrl?: string; // For streaming the active Browserbase view
    confirmationCardData?: {
      title: string;
      cost: string;
    };
  };
}

```

---

## 5. Zero-Conflict GitHub Workflow Protocol

To guarantee that Pull Requests merge smoothly without a single line collision, the codebase strictly prohibits shared files.

### 1. The Repository Directory Tree Blueprint

Files are rigorously organized into isolated directories. Person A and Person B have exclusive write locks on their respective domains.

```bash
├── src/
│   ├── app/                    # UI routes (Shared for design, then Person A binds endpoints)
│   ├── contracts/              # SHARED DIRECTORY (Contains the TS Interfaces above - NEVER MODIFIED AFTER DAY 1)
│   ├── services/               # EXCLUSIVE TO PERSON A
│   │   ├── database.ts         # Postgres & pgvector queries
│   │   ├── orchestrator.ts     # Context hydration & LLM looping
│   │   └── sseManager.ts       # Outbound streaming mechanics
│   └── tools/                  # EXCLUSIVE TO PERSON B
│       ├── browserCore.ts      # Browserbase connection drivers
│       ├── expediaMacro.ts     # Scrape & Click paths
│       └── guardrails.ts       # Execution interruption engine

```

### 2. Operational Git Ground Rules

* **Main Branch Protection:** Direct pushes to `main` are strictly locked out.
* **Atomic Isolation Branching:** Developers create specialized execution paths diverging cleanly from main:
* `person-a/postgres-context-hydration`
* `person-b/browserbase-expedia-automation`


* **The Mock Integration Routine (Day 1 Strategy):** On Day 1, Person A writes a completely fake, static version of Person B’s engine inside `services/orchestrator.ts` that automatically returns mock hotel data after 3 seconds. This allows Person A to build, test, and finish the entire streaming system on DigitalOcean independently. In parallel, Person B uses a local mock script to feed hardcoded variables into their Playwright code.
* **The Seamless Handshake:** When both developers pull down each other's feature branches, Person A simply deletes the mock data loop and replaces it with an import statement calling Person B's verified code: `import { executeBrowserTask } from '../tools/browserCore'`. Since they never edited the same files, git merges the entire architecture seamlessly.