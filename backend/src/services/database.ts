// PERSON A — Database service (pg + pgvector)
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

// ── Health ────────────────────────────────────────────────────────────────
export async function ping(): Promise<boolean> {
  const res = await pool.query('SELECT 1');
  return res.rowCount === 1;
}

// ── Users ─────────────────────────────────────────────────────────────────
export async function getUserById(id: string) {
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function createUser(email: string, displayName: string) {
  const res = await pool.query(
    'INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING *',
    [email, displayName],
  );
  return res.rows[0];
}

// ── Agents ────────────────────────────────────────────────────────────────
export async function getAllAgents() {
  const res = await pool.query('SELECT * FROM agents ORDER BY created_at');
  return res.rows;
}

export async function getAgentById(id: string) {
  const res = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function getAgentBySlug(slug: string) {
  const res = await pool.query('SELECT * FROM agents WHERE slug = $1', [slug]);
  return res.rows[0] ?? null;
}

// ── Runs ──────────────────────────────────────────────────────────────────
export async function createRun(userId: string, agentId: string, prompt: string) {
  const res = await pool.query(
    `INSERT INTO runs (user_id, agent_id, prompt, status)
     VALUES ($1, $2, $3, 'QUEUED') RETURNING *`,
    [userId, agentId, prompt],
  );
  return res.rows[0];
}

export async function getRunById(id: string) {
  const res = await pool.query('SELECT * FROM runs WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function updateRunStatus(
  id: string,
  status: string,
  extra?: { guardrail_payload?: unknown; browserbase_session_id?: string },
) {
  const parts: string[] = ['status = $2', 'updated_at = now()'];
  const values: unknown[] = [id, status];
  let idx = 3;

  if (extra?.guardrail_payload !== undefined) {
    parts.push(`guardrail_payload = $${idx}`);
    values.push(JSON.stringify(extra.guardrail_payload));
    idx++;
  }
  if (extra?.browserbase_session_id !== undefined) {
    parts.push(`browserbase_session_id = $${idx}`);
    values.push(extra.browserbase_session_id);
    idx++;
  }

  const res = await pool.query(
    `UPDATE runs SET ${parts.join(', ')} WHERE id = $1 RETURNING *`,
    values,
  );
  return res.rows[0];
}

// ── Run Events (append-only SSE replay log) ───────────────────────────────
export async function insertRunEvent(
  runId: string,
  type: string,
  message: string,
  payload?: unknown,
) {
  const res = await pool.query(
    `INSERT INTO run_events (run_id, type, message, payload)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [runId, type, message, payload ? JSON.stringify(payload) : null],
  );
  return res.rows[0];
}

export async function getRunEventsSince(runId: string, sinceId?: string) {
  if (sinceId) {
    const res = await pool.query(
      `SELECT * FROM run_events
       WHERE run_id = $1 AND id > $2
       ORDER BY created_at ASC`,
      [runId, sinceId],
    );
    return res.rows;
  }
  const res = await pool.query(
    'SELECT * FROM run_events WHERE run_id = $1 ORDER BY created_at ASC',
    [runId],
  );
  return res.rows;
}

// ── Information Commons (cross-agent shared context) ──────────────────────
export async function getCommonsFacts(userId: string) {
  const res = await pool.query(
    'SELECT id, fact, category, updated_at FROM commons_facts WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );
  return res.rows;
}

export async function updateCommonsFact(factId: string, fact: string) {
  const res = await pool.query(
    'UPDATE commons_facts SET fact = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [factId, fact],
  );
  return res.rows[0];
}

export async function insertCommonsFact(
  userId: string,
  fact: string,
  embedding: number[],
  category?: string,
) {
  const res = await pool.query(
    `INSERT INTO commons_facts (user_id, fact, embedding, category)
     VALUES ($1, $2, $3::vector, $4) RETURNING *`,
    [userId, fact, `[${embedding.join(',')}]`, category ?? null],
  );
  return res.rows[0];
}

/**
 * Semantic search over Information Commons.
 * Returns top-k facts for a user, ranked by cosine similarity.
 */
export async function searchCommonsFacts(
  userId: string,
  queryEmbedding: number[],
  topK = 10,
) {
  const res = await pool.query(
    `SELECT id, fact, category, 1 - (embedding <=> $2::vector) AS similarity
     FROM commons_facts
     WHERE user_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [userId, `[${queryEmbedding.join(',')}]`, topK],
  );
  return res.rows;
}

// ── Episodic Memory (strict per-agent isolation) ──────────────────────────
export async function insertEpisodicMemory(
  userId: string,
  agentId: string,
  summary: string,
  embedding: number[],
  runId?: string,
) {
  const res = await pool.query(
    `INSERT INTO episodic_memories (user_id, agent_id, summary, embedding, run_id)
     VALUES ($1, $2, $3, $4::vector, $5) RETURNING *`,
    [userId, agentId, summary, `[${embedding.join(',')}]`, runId ?? null],
  );
  return res.rows[0];
}

/**
 * Semantic search over episodic memory — STRICT ISOLATION.
 * Every query MUST filter by (user_id, agent_id). No cross-agent reads, ever.
 */
export async function searchEpisodicMemories(
  userId: string,
  agentId: string,
  queryEmbedding: number[],
  topK = 5,
) {
  const res = await pool.query(
    `SELECT id, summary, run_id, created_at,
            1 - (embedding <=> $3::vector) AS similarity
     FROM episodic_memories
     WHERE user_id = $1 AND agent_id = $2
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [userId, agentId, `[${queryEmbedding.join(',')}]`, topK],
  );
  return res.rows;
}

// ── Browser Contexts ──────────────────────────────────────────────────────
export async function getBrowserContext(userId: string, site: string) {
  const res = await pool.query(
    'SELECT * FROM browser_contexts WHERE user_id = $1 AND site = $2',
    [userId, site],
  );
  return res.rows[0] ?? null;
}

export async function upsertBrowserContext(
  userId: string,
  site: string,
  browserbaseContextId: string,
) {
  const res = await pool.query(
    `INSERT INTO browser_contexts (user_id, site, browserbase_context_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, site)
     DO UPDATE SET browserbase_context_id = $3, updated_at = now()
     RETURNING *`,
    [userId, site, browserbaseContextId],
  );
  return res.rows[0];
}

export { pool };
