-- Astor Backend — Grocery Runner Schema
-- Adds shopping-list persistence and a cross-run product scrape cache.

CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | final | ordered
  budget_cents INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  constraints JSONB DEFAULT '[]' -- ["organic","lactose-free"]
);

-- Per-store, per-item scrape cache. Unused since the pivot away from live
-- browser scraping (Walmart/Costco/Whole Foods have no public APIs and
-- reliably blocked automated scraping) — kept as inert schema rather than a
-- destructive drop; no application code reads or writes this table anymore.
CREATE TABLE IF NOT EXISTS product_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store TEXT NOT NULL,
  query_norm TEXT NOT NULL, -- lowercased/trimmed item name
  product JSONB NOT NULL,   -- IProductOption
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store, query_norm)
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id
  ON shopping_list_items (list_id);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_run_id
  ON shopping_lists (run_id);

CREATE INDEX IF NOT EXISTS idx_product_cache_lookup
  ON product_cache (store, query_norm);
