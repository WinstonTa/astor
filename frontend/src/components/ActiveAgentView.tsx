import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, CircleCheck, Loader2, XCircle } from "lucide-react";
import type { Agent } from "../data/agents";
import { StatusRing } from "./StatusRing";
import { TelemetryStatusBar } from "./TelemetryStatusBar";
import { ViewportPanel } from "./ViewportPanel";
import { FloatingAgentChat } from "./FloatingAgentChat";
import { GuardrailModal } from "./GuardrailModal";
import { useRunStream } from "../lib/useRunStream";
import { startRun, confirmRun, replyToAgent } from "../lib/api";

type GuardrailState = "pending" | "authorized" | "dismissed";
type RunPhase = "idle" | "starting" | "running" | "complete" | "failed";

const DEFAULT_PROMPTS: Record<string, string> = {
  "hotel-booker": "Book a hotel in Seattle under $200 for next weekend",
  "finance-ledger": "Show my spending summary for this month",
  "mom-scheduler": "Schedule a dentist appointment for next Tuesday",
  "grocery-runner": "Order my weekly groceries from Whole Foods",
  "inbox-triage": "Triage my inbox and flag anything urgent",
  "travel-concierge": "Plan a 3-day trip to Portland under $1500",
};

function deriveRunStatus(events: { type: string }[]): "idle" | "running" | "attention" {
  if (events.length === 0) return "running";
  const last = events[events.length - 1];
  if (last.type === "complete") return "idle";
  if (last.type === "action_required") return "attention";
  return "running";
}

export function ActiveAgentView({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [guardrail, setGuardrail] = useState<GuardrailState>("pending");
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS[agent.slug] ?? "");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "agent"; message: string }>>([]);

  const { events } = useRunStream(runId);
  const Icon = agent.icon;

  const hasGuardrail = events.some((e) => e.type === "action_required");
  const isComplete = events.some((e) => e.type === "complete");
  const isFailed = events.some((e) => e.type === "complete" && e.message.toLowerCase().includes("fail"));
  const lastEvent = events[events.length - 1];
  const guardrailPayload = events.find((e) => e.type === "action_required")?.payload;

  // Track agent messages and add to chat history
  useEffect(() => {
    const agentMessages = events.filter((e) => e.type === "agent_message");
    const newMessages = agentMessages.map((e) => ({ role: "agent" as const, message: e.message }));
    if (newMessages.length > 0) {
      setChatHistory((prev) => {
        const existing = prev.filter((m) => m.role === "user");
        return [...existing, ...newMessages];
      });
    }
  }, [events]);

  const isWaitingForReply = events.some((e) => e.type === "agent_message") &&
    !events.some((e) => e.type === "complete") &&
    !events.some((e) => e.type === "action_required");

  const handleStart = useCallback(async () => {
    if (!prompt.trim()) return;
    setRunPhase("starting");
    setError(null);
    setGuardrail("pending");

    try {
      const agentId = agent.dbId ?? agent.id;
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
    if (!runId) return;
    try {
      await confirmRun(runId, decision);
      setGuardrail(decision === "authorize" ? "authorized" : "dismissed");
    } catch {
      setGuardrail(decision === "authorize" ? "authorized" : "dismissed");
    }
  }, [runId]);

  const handleReply = useCallback((userReply: string) => {
    if (!runId || !userReply.trim()) return;
    setChatHistory((prev) => [...prev, { role: "user", message: userReply }]);
    replyToAgent(runId, userReply).catch((err: any) => {
      setError(err.message ?? "Failed to send reply");
    });
  }, [runId]);

  const displayStatus = runPhase === "running"
    ? deriveRunStatus(events)
    : runPhase === "starting" ? "running" as const
    : agent.status;

  const isRunning = runPhase === "running" || runPhase === "starting";

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden">
      {/* ── Header (compact, always visible) ─────────────────────────── */}
      <div className="relative z-30 flex items-center justify-between border-b border-border/20 bg-obsidian/60 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-secondary-glass flex h-8 w-8 items-center justify-center rounded-full border border-border/40 text-muted-foreground transition-all duration-200 hover:border-brass/25 hover:text-foreground"
          >
            <ArrowLeft size={14} />
          </button>
          <div
            className="relative flex h-9 w-9 items-center justify-center rounded-[11px] border backdrop-blur-sm"
            style={{
              backgroundColor: `${agent.accent}10`,
              borderColor: `${agent.accent}28`,
            }}
          >
            <Icon size={17} strokeWidth={1.6} style={{ color: agent.accent }} />
          </div>
          <div>
            <h1 className="font-display text-[16px] leading-tight font-medium text-bone">
              {agent.name}
            </h1>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
              {runId ? `Session · ${runId.slice(0, 8)}` : "No active session"}
            </p>
          </div>
        </div>

        {/* Telemetry status bar (center) */}
        {isRunning && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <TelemetryStatusBar events={events} />
          </div>
        )}

        <StatusRing status={guardrail === "authorized" ? "idle" : displayStatus} />
      </div>

      {/* ── Content area ─────────────────────────────────────────────── */}
      {isRunning ? (
        /* Full-screen browser viewport when running */
        <div className="relative flex-1">
          <ViewportPanel
            screenshotUrl={events.find((e) => e.payload?.screenshotUrl)?.payload?.screenshotUrl}
            fullScreen
          />

          {/* Guardrail modal */}
          {hasGuardrail && guardrail === "pending" && !isComplete && (
            <GuardrailModal
              open={true}
              runId={runId}
              payload={guardrailPayload}
              onCancel={() => handleGuardrailConfirm("cancel")}
              onAuthorize={() => handleGuardrailConfirm("authorize")}
            />
          )}

          {/* Authorization confirmed overlay */}
          {guardrail === "authorized" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-obsidian/80 backdrop-blur-md">
              <div className="glass-panel animate-rise flex flex-col items-center gap-4 rounded-[18px] border border-phosphor/15 px-8 py-7 text-center shadow-[0_0_40px_rgba(125,255,176,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-phosphor/10">
                  <CircleCheck size={24} className="text-[var(--color-phosphor)]" />
                </div>
                <p className="font-display text-[17px] text-[var(--color-bone)]">
                  {lastEvent?.message ?? "Booking confirmed"}
                </p>
                <p className="max-w-[240px] text-[12.5px] leading-relaxed text-[var(--color-bone-dim)]">
                  Episodic memory will store this transaction for future {agent.name} runs.
                </p>
              </div>
            </div>
          )}

          {/* Run complete overlay */}
          {isComplete && guardrail !== "authorized" && !hasGuardrail && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-obsidian/80 backdrop-blur-md">
              <div className="glass-panel animate-rise flex flex-col items-center gap-4 rounded-[18px] border border-phosphor/15 px-8 py-7 text-center shadow-[0_0_40px_rgba(125,255,176,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-phosphor/10">
                  <CircleCheck size={24} className="text-[var(--color-phosphor)]" />
                </div>
                <p className="font-display text-[17px] text-[var(--color-bone)]">
                  {lastEvent?.message ?? "Task complete"}
                </p>
              </div>
            </div>
          )}

          {/* Failed overlay */}
          {isFailed && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-obsidian/80 backdrop-blur-md">
              <div className="glass-panel animate-rise flex flex-col items-center gap-4 rounded-[18px] border border-coral-signal/25 px-8 py-7 text-center shadow-[0_0_40px_rgba(255,92,77,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-signal/10">
                  <XCircle size={24} className="text-[var(--color-coral-signal)]" />
                </div>
                <p className="font-display text-[17px] text-[var(--color-bone)]">
                  {lastEvent?.message ?? "Run failed"}
                </p>
                <button
                  onClick={() => { setRunPhase("idle"); setRunId(null); setGuardrail("pending"); setChatHistory([]); }}
                  className="btn-secondary-glass mt-1 rounded-[10px] border border-border/40 px-5 py-2 font-mono text-[11px] text-[var(--color-bone-dim)] transition-colors hover:border-brass/20 hover:text-[var(--color-bone)]"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* User-cancelled overlay */}
          {guardrail === "dismissed" && !isComplete && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-obsidian/80 backdrop-blur-md">
              <div className="glass-panel animate-rise flex flex-col items-center gap-4 rounded-[18px] border border-border/30 px-8 py-7 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <XCircle size={24} className="text-[var(--color-bone-dim)]" />
                </div>
                <p className="font-display text-[17px] text-[var(--color-bone)]">
                  Execution cancelled
                </p>
                <button
                  onClick={() => { setRunPhase("idle"); setRunId(null); setGuardrail("pending"); setChatHistory([]); }}
                  className="btn-secondary-glass mt-1 rounded-[10px] border border-border/40 px-5 py-2 font-mono text-[11px] text-[var(--color-bone-dim)] transition-colors hover:border-brass/20 hover:text-[var(--color-bone)]"
                >
                  Run again
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Idle / Failed state — centered prompt input */
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-lg animate-rise">
            <div className="mb-6 text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] border backdrop-blur-sm"
                style={{
                  backgroundColor: `${agent.accent}10`,
                  borderColor: `${agent.accent}28`,
                  boxShadow: `0 0 30px ${agent.accent}15`,
                }}
              >
                <Icon size={28} strokeWidth={1.4} style={{ color: agent.accent }} />
              </div>
              <h2 className="font-display text-[20px] font-medium text-bone">{agent.name}</h2>
              <p className="mt-1 font-mono text-[11px] text-bone-faint/60">
                Ready to assist you
              </p>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  placeholder="Tell the agent what to do..."
                  className="glass-input w-full rounded-[12px] px-4 py-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:shadow-[0_0_20px_rgba(204,154,78,0.08)]"
                />
              </div>
              <button
                onClick={handleStart}
                disabled={!prompt.trim()}
                className="btn-primary-glass flex items-center gap-2 rounded-[12px] px-5 py-3 font-mono text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-all duration-200 hover:opacity-90 hover:shadow-[0_4px_16px_rgba(204,154,78,0.2)] disabled:opacity-40"
              >
                Run
              </button>
            </div>
            {error && (
              <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-coral-signal)]">
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--color-coral-signal)]" />
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Floating Chat (bottom-left, only when running) ──────────── */}
      {isRunning && (
        <FloatingAgentChat
          chatHistory={chatHistory}
          isWaitingForReply={isWaitingForReply}
          onSendReply={handleReply}
          agentName={agent.name}
          agentAccent={agent.accent}
        />
      )}
    </div>
  );
}
