-- Astor Backend — Initial Schema
-- Requires: CREATE EXTENSION IF NOT EXISTS vector;

CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Identity & agent registry
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT,
  tool_manifest JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Run tracking
CREATE TYPE run_status AS ENUM (
  'QUEUED', 'HYDRATING', 'THINKING', 'EXECUTING_TOOL',
  'AWAITING_CONFIRMATION', 'FINALIZING',
  'COMPLETE', 'FAILED', 'CANCELLED'
);

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status run_status NOT NULL DEFAULT 'QUEUED',
  guardrail_payload JSONB,
  browserbase_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Information Commons (cross-agent shared context)
CREATE TABLE IF NOT EXISTS commons_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  embedding vector(1536),
  category TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Isolated per-agent episodic memory
CREATE TABLE IF NOT EXISTS episodic_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  embedding vector(1536),
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Browserbase cookie vault
CREATE TABLE IF NOT EXISTS browser_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site TEXT NOT NULL,
  browserbase_context_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, site)
);

-- Indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_commons_facts_embedding
  ON commons_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_episodic_memories_embedding
  ON episodic_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for run_events replay
CREATE INDEX IF NOT EXISTS idx_run_events_run_id
  ON run_events (run_id, created_at);

-- Seed agents
INSERT INTO agents (slug, name, purpose, tool_manifest) VALUES
  ('hotel-booker', 'Hotel Booker', 'Search and book hotels at the best price', '{"tools": ["browser_search", "browser_book"]}'),
  ('finance-ledger', 'Finance Ledger', 'Track expenses and manage budgets', '{"tools": ["spreadsheet", "api_query"]}'),
  ('mom-scheduler', 'Mom Scheduler', 'Manage family schedules and reminders', '{"tools": ["calendar", "notification"]}'),
  ('grocery-runner', 'Grocery Runner', 'Order groceries at the best deals', '{"tools": ["browser_search", "browser_order"]}'),
  ('inbox-triage', 'Inbox Triage', 'Sort and prioritize your email inbox', '{"tools": ["email_read", "email_sort"]}'),
  ('travel-concierge', 'Travel Concierge', 'Plan and book complete travel itineraries', '{"tools": ["browser_search", "browser_book", "calendar"]}')
ON CONFLICT (slug) DO NOTHING;
