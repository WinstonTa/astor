import { useState, useCallback } from "react";
import { ArrowLeft, CircleCheck, Loader2 } from "lucide-react";
import type { Agent } from "../data/agents";
import { StatusRing } from "./StatusRing";
import { TelemetryLog } from "./TelemetryLog";
import { ViewportPanel } from "./ViewportPanel";
import { GuardrailModal } from "./GuardrailModal";
import { useRunStream } from "../lib/useRunStream";
import { startRun } from "../lib/api";

type GuardrailState = "pending" | "authorized" | "dismissed";
type RunPhase = "idle" | "starting" | "running" | "complete" | "failed";

// Default prompts per agent slug
const DEFAULT_PROMPTS: Record<string, string> = {
  "hotel-booker": "Book a hotel in Seattle under $200 for next weekend",
  "finance-ledger": "Show my spending summary for this month",
  "mom-scheduler": "Schedule a dentist appointment for next Tuesday",
  "grocery-runner": "Order my weekly groceries from Whole Foods",
  "inbox-triage": "Triage my inbox and flag anything urgent",
  "travel-concierge": "Plan a 3-day trip to Portland under $1500",
};

export function ActiveAgentView({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [guardrail, setGuardrail] = useState<GuardrailState>("pending");
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS[agent.slug] ?? "");
  const [error, setError] = useState<string | null>(null);

  const { events } = useRunStream(runId);
  const Icon = agent.icon;

  // Check if run reached the guardrail state
  const hasGuardrail = events.some((e) => e.type === "action_required");
  const isComplete = events.some((e) => e.type === "complete");
  const lastEvent = events[events.length - 1];

  const handleStart = useCallback(async () => {
    if (!prompt.trim()) return;
    setRunPhase("starting");
    setError(null);
    setGuardrail("pending");

    try {
      // Use dbId if available (from API), otherwise use slug as fallback
      const agentId = agent.dbId ?? agent.id;
      // TODO: get real userId from auth context
      const userId = "00000000-0000-0000-0000-000000000001";
      const res = await startRun(userId, agentId, prompt);
      setRunId(res.runId);
      setRunPhase("running");
    } catch (err: any) {
      setError(err.message ?? "Failed to start run");
      setRunPhase("failed");
    }
  }, [prompt, agent.dbId, agent.id]);

  const handleGuardrailConfirm = useCallback(async (decision: "authorize" | "cancel") => {
    setGuardrail(decision === "authorize" ? "authorized" : "dismissed");
    // Phase 2 will wire this to POST /api/agent/confirm
  }, []);

  // Derive display status
  const displayStatus = runPhase === "running"
    ? (isComplete ? "idle" : hasGuardrail ? "attention" : "running")
    : runPhase === "starting" ? "running"
    : agent.status;

  return (
    <div className="flex h-full flex-1 flex-col px-10 py-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between animate-rise">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-hairline)] text-[var(--color-bone-dim)] transition-colors hover:border-[var(--color-hairline-strong)] hover:text-[var(--color-bone)]"
          >
            <ArrowLeft size={16} />
          </button>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[13px] border"
            style={{ backgroundColor: `${agent.accent}14`, borderColor: `${agent.accent}33` }}
          >
            <Icon size={20} strokeWidth={1.6} style={{ color: agent.accent }} />
          </div>
          <div>
            <h1 className="font-display text-[22px] font-medium leading-tight text-[var(--color-bone)]">
              {agent.name}
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-bone-faint)]">
              {runId ? `Session · ${runId.slice(0, 8)}` : "No active session"}
            </p>
          </div>
        </div>
        <StatusRing status={guardrail === "authorized" ? "idle" : displayStatus} />
      </div>

      {/* ── Prompt input ────────────────────────────────────────────── */}
      {runPhase === "idle" || runPhase === "failed" ? (
        <div className="mb-5 animate-rise">
          <div className="flex gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="Tell the agent what to do..."
              className="flex-1 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-panel)] px-4 py-3 font-mono text-[13px] text-[var(--color-bone)] placeholder:text-[var(--color-bone-faint)] focus:border-[var(--color-brass)] focus:outline-none"
            />
            <button
              onClick={handleStart}
              disabled={!prompt.trim()}
              className="flex items-center gap-2 rounded-[12px] bg-gradient-to-b from-[var(--color-brass)] to-[var(--color-brass-bright)] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#241a0c] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Run
            </button>
          </div>
          {error && (
            <p className="mt-2 font-mono text-[11px] text-[var(--color-coral-signal)]">{error}</p>
          )}
        </div>
      ) : runPhase === "starting" ? (
        <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-panel)] px-4 py-3">
          <Loader2 size={16} className="animate-spin text-[var(--color-brass)]" />
          <span className="font-mono text-[12px] text-[var(--color-bone-dim)]">Starting run...</span>
        </div>
      ) : null}

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
        <TelemetryLog events={events} />
        <ViewportPanel screenshotUrl={events.find((e) => e.payload?.screenshotUrl)?.payload?.screenshotUrl} />

        {/* Guardrail modal — shown when run hits action_required */}
        {runPhase === "running" && hasGuardrail && guardrail === "pending" && !isComplete && (
          <GuardrailModal
            open={true}
            runId={runId}
            payload={events.find((e) => e.type === "action_required")?.payload}
            onCancel={() => handleGuardrailConfirm("cancel")}
            onAuthorize={() => handleGuardrailConfirm("authorize")}
          />
        )}

        {/* Authorization confirmation overlay */}
        {guardrail === "authorized" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm">
            <div className="animate-rise flex flex-col items-center gap-3 rounded-[18px] border border-[var(--color-phosphor-dim)]/50 bg-[var(--color-panel-raised)] px-8 py-7 text-center">
              <CircleCheck size={28} className="text-[var(--color-phosphor)]" />
              <p className="font-display text-[17px] text-[var(--color-bone)]">
                {lastEvent?.message ?? "Booking confirmed"}
              </p>
              <p className="max-w-[240px] text-[12.5px] text-[var(--color-bone-dim)]">
                Episodic memory will store this transaction for future {agent.name} runs.
              </p>
            </div>
          </div>
        )}

        {/* Run complete overlay */}
        {isComplete && guardrail !== "authorized" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm">
            <div className="animate-rise flex flex-col items-center gap-3 rounded-[18px] border border-[var(--color-phosphor-dim)]/50 bg-[var(--color-panel-raised)] px-8 py-7 text-center">
              <CircleCheck size={28} className="text-[var(--color-phosphor)]" />
              <p className="font-display text-[17px] text-[var(--color-bone)]">
                {lastEvent?.message ?? "Task complete"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
