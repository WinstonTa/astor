**Objective:** Create a static, production-grade responsive dashboard layout for an AI Agent Marketplace using React, Tailwind CSS, and lucide-react icons. The design language must mimic a clean, ultra-modern smartphone OS app-grid hybrid interface.

**Visual Layout Requirements:**
1. **The Navigation Sidebar:** A collapsible, minimal vertical rail on the left showing links for: "Marketplace Grid", "Information Commons (Shared Preferences)", and "Security Settings".
2. **The Agent App Grid:** The main content panel must display a multi-column CSS grid containing rounded dashboard cards representing different agents.
   - Each card must display an icon container, an Agent Title (e.g., "Hotel Booker", "Finance Ledger", "Mom Scheduler"), a short descriptive purpose sentence, and a localized visual status dot ring indicating ("IDLE" in green, "RUNNING" in amber, or "ATTENTION" in red).

**The Active Agent Simulation View (The Hotel Booker Case):**
Make it so clicking the "Hotel Booker" card changes the state of the interface layout to display a split-screen active workspace configuration:
1. **Left Side Pane (The Activity Log):** A dark, monospace terminal panel window labeled "Agent Telemetry Log". Pre-populate it with mock static text rows to establish layout spacing:
   - "🔍 [00:02] Hydrating engine with Information Commons data..."
   - "🧠 [00:04] Context combined. LLM requesting Browserbase invocation..."
   - "🌐 [00:05] Spawning headless Chrome node on browserbase platform..."
2. **Right Side Pane (The Viewport Preview):** A bounded container container titled "Live Agent Stream". Inside this container, render a static placeholder image representing a live Expedia search, overlaid with a subtle semi-transparent canvas grid filter effect to simulate watching an automated remote browser worker.
3. **The Transaction Guardrail Overlay Modal:** Inside the expanded view, implement an absolute-positioned high-contrast card block titled "⚠️ Action Authorization Required". It must display a clear message block stating: "Agent is ready to book The Paramount Hotel Seattle for $185.00 using your saved profile metadata.", flanked by two prominent functional interactive action button elements labeled "[ Cancel Execution Loop ]" and "[ Authorize & Confirm Purchase ]".

**Code Structure Rules:**
- Write clean, semantic modular HTML layout tags decorated cleanly with utility-first Tailwind CSS selectors.
- Do not add complex fetch methods or external data listeners yet. Keep state management localized entirely to a single `activeAgentId` variable toggled via card interaction hooks to alternate between the grid display layout and the active runtime view.

**System Design:**
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BROWSER VIEWPORT                                          │
│                     - Orchestrates Top-Level Window & Navigation State                       │
└────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DASHBOARD CANVAS                                          │
│                  - Implements a standard CSS Grid (1x1, 2x2, or 3x3)                         │
│                  - Manages global layout states (Idle vs Active Agent)                       │
└──────────────────────────────┬───────────────────────────────────────┬───────────────────────┘
                               │                                       │
                If Agent is Active                              If Agent is Idle
                               │                                       │
                               ▼                                       ▼

┌──────────────────────────────────────────────────────────────────┐   ┌──────────────────────────────────────────────┐
│                    EXPANDED AGENT VIEWPORT                       │   │             APP CARD REPOSITORY              │
│                                                                  │   │                                              │
│  ┌────────────────────────────────────────────────────────────┐  │   │  ┌────────────────┐  ┌────────────────┐    │
│  │                  LIVE STATUS MONITOR                       │  │   │  │ Hotel Booker  │  │ Finance Agent │    │
│  │  - Renders scrolling "Thinking" logs text rows.            │  │   │  │ - Status ring │  │ - Status ring │    │
│  └────────────────────────────────────────────────────────────┘  │   │  └────────────────┘  └────────────────┘    │
│                                                                  │   │                                              │
│  ┌────────────────────────────────────────────────────────────┐  │   └──────────────────────────────────────────────┘
│  │               REMOTE CANVAS STREAM PANEL                   │  │
│  │  - Buffers and displays dynamic base64/URL images          │  │
│  │    sent from downstream Browserbase frames.                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              DYNAMIC TRANSACTION OVERLAY                   │  │
│  │  - Displays "Awaiting Confirmation" card metrics.          │  │
│  │  - Intercepts view interaction until user accepts.         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
