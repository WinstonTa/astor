import { useEffect, useState, useCallback } from "react";
import { Pencil, Check, X, Loader2, BookOpenText } from "lucide-react";
import { fetchCommons, updateCommonsFact, type ApiCommonsFact } from "../lib/api";

export function CommonsView() {
  const [facts, setFacts] = useState<ApiCommonsFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // TODO: get real userId from auth context
  const userId = "00000000-0000-0000-0000-000000000001";

  useEffect(() => {
    setLoading(true);
    fetchCommons(userId)
      .then((res) => setFacts(res.facts))
      .catch((err) => setError(err.message ?? "Failed to load commons"))
      .finally(() => setLoading(false));
  }, [userId]);

  const startEdit = useCallback((fact: ApiCommonsFact) => {
    setEditingId(fact.id);
    setEditText(fact.fact);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  const saveEdit = useCallback(async (factId: string) => {
    try {
      const res = await updateCommonsFact(factId, editText);
      setFacts((prev) => prev.map((f) => (f.id === factId ? res.fact : f)));
      setEditingId(null);
      setEditText("");
    } catch (err: any) {
      setError(err.message ?? "Failed to update fact");
    }
  }, [editText]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scroll-brass px-10 py-10">
      <header className="mb-8 flex flex-col gap-2 animate-rise">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
          Information Commons
        </span>
        <h1 className="font-display text-[32px] font-medium text-[var(--color-bone)]">
          Shared preferences, across all agents.
        </h1>
        <p className="max-w-xl text-[14px] leading-relaxed text-[var(--color-bone-dim)]">
          These facts hydrate every agent run. Your loyalty status, address, dietary needs —
          anything any agent should know about you.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-3 py-12">
          <Loader2 size={18} className="animate-spin text-[var(--color-brass)]" />
          <span className="font-mono text-[12px] text-[var(--color-bone-dim)]">Loading commons...</span>
        </div>
      ) : error ? (
        <div className="rounded-[14px] border border-[var(--color-coral-signal)]/30 bg-[var(--color-panel)] px-5 py-4">
          <p className="font-mono text-[12px] text-[var(--color-coral-signal)]">{error}</p>
        </div>
      ) : facts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <BookOpenText size={28} className="text-[var(--color-bone-faint)]" />
          <p className="text-[14px] text-[var(--color-bone-dim)]">No facts in the commons yet.</p>
          <p className="text-[12px] text-[var(--color-bone-faint)]">
            Facts are added automatically as agents learn about you.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {facts.map((fact, i) => (
            <div
              key={fact.id}
              className="animate-rise group flex items-start gap-4 rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-panel)] px-5 py-4 transition-colors hover:border-[var(--color-hairline-strong)]"
              style={{ animationDelay: `${i * 0.06 + 0.1}s`, animationFillMode: "backwards" }}
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-brass)]/10">
                <span className="font-mono text-[10px] text-[var(--color-brass-bright)]">
                  {fact.category?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === fact.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(fact.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 rounded-[8px] border border-[var(--color-brass)]/40 bg-black/20 px-3 py-1.5 font-mono text-[12.5px] text-[var(--color-bone)] focus:outline-none"
                    />
                    <button
                      onClick={() => saveEdit(fact.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--color-phosphor)]/15 text-[var(--color-phosphor)] hover:bg-[var(--color-phosphor)]/25"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--color-bone-faint)] hover:bg-white/5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[13.5px] leading-relaxed text-[var(--color-bone)]">
                      {fact.fact}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      {fact.category && (
                        <span className="rounded-full bg-[var(--color-panel-raised)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-bone-faint)]">
                          {fact.category}
                        </span>
                      )}
                      <span className="font-mono text-[9px] text-[var(--color-bone-faint)]">
                        {new Date(fact.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {editingId !== fact.id && (
                <button
                  onClick={() => startEdit(fact)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--color-bone-faint)] opacity-0 transition-opacity hover:bg-white/5 hover:text-[var(--color-bone)] group-hover:opacity-100"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
