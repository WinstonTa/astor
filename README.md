<div align="center">

# Astor

### Your AI Agent Fleet, One Command Away.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Anthropic](https://img.shields.io/badge/Claude-4-cc9a4e?style=flat-square)](https://anthropic.com)
[![Playwright](https://img.shields.io/badge/Playwright-Automation-2ead33?style=flat-square)](https://playwright.dev)

<br/>

**A marketplace of specialist AI agents that book hotels, flights, grocery shop, and manage your life — with real browser automation, live telemetry, and human-in-the-loop guardrails.**

[Demo](#-demo-flow) · [Architecture](#-architecture) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start)

</div>

---

## The Problem

Booking a hotel shouldn't require 47 clicks across 3 tabs. Managing finances shouldn't mean context-switching between 5 apps. **What if you could just ask?**

## The Solution

Astor is an **AI agent marketplace** where each agent is a specialist — Hotel Booker knows hotels, Flight Booker knows flights, Grocery Runner builds your shopping lists, Finance Ledger knows your spending. They share memory through a commons, stream their work in real-time, and always ask before spending your money.

<div align="center">

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   "Book a hotel in downtown Seattle, July 18-20, under $200"   │
│                                                                 │
│                          ↓ routes to ↓                          │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │   Hotel      │  │   Flight    │  │   Finance   │            │
│   │   Booker     │  │   Booker    │  │   Ledger    │  ...       │
│   │   🏨        │  │   ✈️        │  │   💰        │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│         ↓                                                    │
│   ┌─────────────────────────────────────┐                    │
│   │  🔍 Searches Booking.com            │                    │
│   │  🤖 Extracts results via DOM        │                    │
│   │  💬 Recommends best match           │                    │
│   │  🛡️ Guardrail: "Authorize $185?"   │                    │
│   │  ✅ Books & confirms                │                    │
│   └─────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-Agent Orchestration** | Claude-powered agents with specialized system prompts, tools, and personalities |
| 🌐 **Real Browser Automation** | Playwright-driven DOM interaction — no mocks, no shortcuts, real Booking.com |
| 🛒 **Grocery Intelligence** | Shopping list builder with price estimates, stock photos, and downloadable HTML reports |
| 🛡️ **Human-in-the-Loop Guardrails** | Purchase confirmation cards before any money is spent |
| 📡 **Live Telemetry Stream** | SSE-based real-time updates: thinking, tool calls, screenshots, status |
| 🧠 **Shared Information Commons** | Agents read user preferences from a shared memory store on every run |
| ⚡ **Deterministic Fast Path** | CSS selector-based extraction (no LLM per click) — 5-10x faster than vision models |
| 🎨 **Glass-Morphism UI** | Obsidian + brass design system with electric borders and ambient glows |
| 🔀 **Intelligent Routing** | LLM-powered intent router + unified chat bar for natural language agent selection |
| 📄 **Wouter Page Routing** | Multi-page SPA with landing, marketplace, and individual agent routes |

---

## 🏗️ Architecture

```
Frontend (React + Vite)          Backend (Express + TypeScript)
┌──────────────────────┐         ┌──────────────────────────────┐
│                      │         │                              │
│  Wouter Router       │         │  Router (LLM intent classif.)│
│    ├─ Landing Page   │         │         ↓                    │
│    ├─ Marketplace    │         │  Orchestrator (state machine)│
│    └─ Agent Page     │         │    ├─ Context Compiler       │
│                      │         │    ├─ LLM Client (Claude)    │
│  UnifiedChatBar ─────┼────►    │    ├─ Tool Registry          │
│                      │         │    └─ Guardrails             │
│  MarketplaceGrid     │         │                              │
│    └─ AgentCard[]    │         │  Browser Core (Playwright)   │
│                      │         │    ├─ Hotel Macro             │
│  ActiveAgentView     │◄──SSE── │    ├─ Flight Macro            │
│    ├─ ViewportPanel  │         │    └─ Screenshot Loop         │
│    ├─ FloatingChat   │         │                              │
│    ├─ GroceryReport  │         │  Grocery Tools               │
│    └─ TelemetryBar   │         │    ├─ groceryCore.ts          │
│                      │         │    ├─ imageFetch.ts           │
│  Sidebar             │         │    └─ normalize.ts            │
│    ├─ Commons        │         │                              │
│    └─ Security       │         │  PostgreSQL                   │
└──────────────────────┘         └──────────────────────────────┘
```

### The Orchestrator State Machine

```
QUEUED → HYDRATING → THINKING → EXECUTING_TOOL → AWAITING_CONFIRMATION
                                                    ↓
                                              [User Authorizes]
                                                    ↓
                                         FINALIZING → COMPLETE
```

---

## 🎬 Demo Flow

**Hotel Booker (30 seconds):**

1. Open Astor → Landing page animates in
2. Click "Open Marketplace" → Agent grid appears
3. Click **Hotel Booker** → Pre-filled prompt ready
4. Hit **Run** → Agent searches Booking.com in real-time
5. Browser viewport shows the actual site being navigated
6. Agent recommends top pick → Floating chat shows options
7. Say "yes" → Guardrail confirmation card appears
8. Authorize → Booking confirmed ✅

**Flight Booker (30 seconds):**

1. Use the unified chat bar: *"Find a flight from Seattle to New York on July 18"*
2. Intent router routes to Flight Booker automatically
3. Agent searches Google Flights → Shows options
4. Confirm → Booked ✅

**Grocery Runner (30 seconds):**

1. Click **Grocery Runner** in the marketplace
2. Type: *"Restock milk, eggs, bread, and chicken from Whole Foods"*
3. Agent builds a priced shopping list from its knowledge
4. A rich grocery report renders inline — item images, quantities, estimated total
5. Download the report as an HTML file for reference while shopping

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18, Vite, Tailwind CSS 4 | Fast HMR, utility-first styling |
| **Animations** | Motion (Framer) | Buttery smooth 60fps transitions |
| **AI Model** | Anthropic Claude 4 | Best-in-class tool calling & reasoning |
| **Browser Automation** | Playwright via Stagehand | Real DOM interaction, not mocks |
| **Backend** | Express, TypeScript | Lightweight, type-safe API |
| **Database** | PostgreSQL | Persistent agent memory & run history |
| **Real-time** | Server-Sent Events | Live telemetry without WebSocket complexity |
| **Design** | Custom glass-morphism system | Obsidian + brass + electric borders |

</div>

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Anthropic API key
- (Optional) Browserbase API key for cloud browsers

### 1. Clone & Install

```bash
git clone https://github.com/WinstonTa/astor.git
cd astor

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...

# Intent router (DigitalOcean AI endpoint for agent selection)
DIGITAL_OCEAN_MODEL_ACCESS_KEY=your-key-here
LLM_MODEL=deepseek-v4-pro

# Optional (uses local Playwright if omitted)
BROWSERBASE_API_KEY=bb_...

# Optional (custom vision model for browser automation)
STAGEHAND_MODEL=anthropic/anthropic-claude-4.5-sonnet

# Server config
PORT=3001
FRONTEND_URL=http://localhost:5183
```

### 3. Set Up Database

```bash
cd backend
npm run migrate
```

### 4. Run

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open `http://localhost:5183` → Click "Open Marketplace" → Pick an agent → Go.

---

## 🎨 Design System

Astor uses a custom glass-morphism design language:

| Token | Value | Usage |
|-------|-------|-------|
| `--obsidian` | `#0b0a09` | Deep black background |
| `--bone` | `#f2ead9` | Warm off-white text |
| `--brass` | `#cc9a4e` | Primary accent (golden) |
| `--phosphor` | `#7dffb0` | Success/active states |

Fonts:
- **Headings**: Georgia italic (serif elegance)
- **Body**: Instrument Sans (clean, modern)
- **Mono**: IBM Plex Mono (telemetry, labels)

---

## 📁 Project Structure

```
astor/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AgentPage.tsx       # Individual agent view (wouter route)
│   │   │   └── MarketplacePage.tsx # Marketplace grid + sidebar (wouter route)
│   │   ├── components/
│   │   │   ├── ui/                 # ElectricBorder, PixelCanvas, PixelHero
│   │   │   ├── ActiveAgentView.tsx # Agent run interface
│   │   │   ├── AgentCard.tsx       # Marketplace grid cards
│   │   │   ├── FloatingAgentChat.tsx
│   │   │   ├── GroceryReportView.tsx # Rich grocery report renderer
│   │   │   ├── MarketplaceGrid.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StarRating.tsx      # Agent rating display
│   │   │   └── UnifiedChatBar.tsx  # Intent-based chat input
│   │   ├── data/agents.ts          # Agent definitions & colors
│   │   └── lib/
│   │       ├── api.ts              # Backend API client
│   │       └── groceryReportHtml.ts # HTML export for grocery reports
│   └── index.css                   # Design tokens & glass system
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── runRoutes.ts        # POST /api/agent/run
│   │   │   ├── streamRoutes.ts     # SSE telemetry stream
│   │   │   ├── confirmRoutes.ts    # Guardrail confirm/reply
│   │   │   ├── commonsRoutes.ts    # Shared memory CRUD
│   │   │   └── chatRoutes.ts       # POST /api/chat (unified routing)
│   │   ├── services/
│   │   │   ├── orchestrator.ts     # Run state machine
│   │   │   ├── agentPrompts.ts     # Agent system prompts
│   │   │   ├── llmClient.ts        # Anthropic Claude integration
│   │   │   ├── router.ts           # LLM-based intent classification
│   │   │   ├── database.ts         # PostgreSQL queries
│   │   │   └── sseManager.ts       # SSE connection manager
│   │   ├── tools/
│   │   │   ├── browserCore.ts      # Playwright session lifecycle
│   │   │   ├── expediaMacro.ts     # Booking.com automation
│   │   │   ├── flightMacro.ts      # Google Flights automation
│   │   │   ├── hotelMacroPlaywright.ts  # Fast deterministic path
│   │   │   └── grocery/
│   │   │       ├── groceryCore.ts  # Shopping list builder (no browser)
│   │   │       ├── imageFetch.ts   # Stock photo resolver
│   │   │       └── normalize.ts    # Price/quantity formatting
│   │   └── contracts/              # TypeScript interfaces
│   └── migrations/                 # PostgreSQL schema
```

---

## 🧪 How It Works

### Agent Routing

When you type a message in the unified chat bar, the **LLM Intent Router** (`router.ts`) classifies it and routes to the right agent:

```
"Book a hotel in Austin"       →  Hotel Booker
"Find a flight to Tokyo"       →  Flight Booker
"Restock groceries from Whole Foods" →  Grocery Runner
"How much did I spend?"        →  Finance Ledger
```

The router uses a lightweight LLM call to match user intent against the agent roster (slug, name, purpose) and returns the best-fit agent slug with a confidence score.

### Tool Calling

Each agent has specific tools defined in `toolRegistry.ts`. When Claude decides to call a tool:

1. The orchestrator receives the tool call
2. For **browser tools** (hotel, flight), it spins up a Playwright session
3. The macro navigates to the target site and extracts results
4. For **grocery tools**, the LLM builds a priced shopping list from its knowledge — no browser needed since grocery stores block automation
5. Results flow back to Claude for presentation

### Grocery Runner

Unlike hotel/flight agents, Grocery Runner doesn't use browser automation. Grocery stores (Walmart, Costco, Whole Foods) reliably block scraping, so the agent:

1. Proposes a shopping list with estimated prices from its training data
2. Resolves a stock photo for each item via `imageFetch.ts`
3. Computes the authoritative total via `normalize.ts`
4. Renders a rich report (GroceryReportView) with images, quantities, and downloadable HTML

### Guardrails

Before any purchase, the system:
1. Pauses execution
2. Sends a confirmation card to the frontend
3. Waits for explicit user authorization
4. Only then proceeds with the booking

---

## 🏆 What Makes Astor Special

1. **Real automation, not demos** — The hotel booker actually navigates Booking.com and extracts real results
2. **Deterministic speed** — CSS selectors instead of vision models for 5-10x faster execution
3. **Smart agent diversity** — Browser agents for travel, knowledge agents for groceries — each domain uses the right approach
4. **Production-ready patterns** — State machines, guardrails, error recovery, session persistence
5. **Beautiful UI** — Custom glass-morphism design system with electric borders, star ratings, and rich report views
6. **Extensible** — Adding a new agent is just: system prompt + tools + macro (or no macro for knowledge-based agents)

---

<div align="center">

**Built with ❤️ for the Butterbase Hackathon**

*Agent Deck — Where every task has a specialist.*

</div>
