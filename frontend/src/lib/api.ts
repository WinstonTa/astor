// Frontend API client — talks to the Astor backend
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

// ── Types matching the backend ────────────────────────────────────────────
export interface ApiAgent {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  tool_manifest: { tools?: string[] };
  created_at: string;
}

export interface ApiCommonsFact {
  id: string;
  fact: string;
  category: string | null;
  updated_at: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────
export function fetchAgents(): Promise<{ agents: ApiAgent[] }> {
  return request("/api/agents");
}

export function startRun(userId: string, agentId: string, prompt: string): Promise<{ runId: string }> {
  return request("/api/agent/run", {
    method: "POST",
    body: JSON.stringify({ userId, agentId, prompt }),
  });
}

export function confirmRun(runId: string, decision: "authorize" | "cancel"): Promise<{ ok: boolean }> {
  return request("/api/agent/confirm", {
    method: "POST",
    body: JSON.stringify({ runId, decision }),
  });
}

export function replyToAgent(runId: string, reply: string): Promise<{ ok: boolean }> {
  return request("/api/agent/reply", {
    method: "POST",
    body: JSON.stringify({ runId, reply }),
  });
}

export function fetchCommons(userId: string): Promise<{ facts: ApiCommonsFact[] }> {
  return request(`/api/commons?userId=${encodeURIComponent(userId)}`);
}

export function updateCommonsFact(factId: string, fact: string): Promise<{ fact: ApiCommonsFact }> {
  return request(`/api/commons/${factId}`, {
    method: "PUT",
    body: JSON.stringify({ fact }),
  });
}
