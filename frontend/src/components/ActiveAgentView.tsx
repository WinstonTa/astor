import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, CircleCheck, XCircle } from "lucide-react";
import type { Agent } from "../data/agents";
import { StatusRing } from "./StatusRing";
import { TelemetryStatusBar } from "./TelemetryStatusBar";
import { ViewportPanel } from "./ViewportPanel";
import { GroceryReportView } from "./GroceryReportView";
import { FloatingAgentChat } from "./FloatingAgentChat";
import { useRunStream } from "../lib/useRunStream";
import { startRun, confirmRun, replyToAgent } from "../lib/api";

type GuardrailState = "pending" | "authorized" | "dismissed";
type RunPhase = "idle" | "starting" | "running" | "complete" | "failed";

const DEFAULT_PROMPTS: Record<string, string> = {
  "hotel-booker": "Book a hotel in Seattle under $200 for next weekend",
  "finance-ledger": "Show my spending summary for this month",
  "mom-scheduler": "Schedule a dentist appointment for next Tuesday",
  "grocery-runner": "Help me build a grocery list for taco night",
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
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "agent"; message: string }>>([]);

  const { events } = useRunStream(runId);
  const Icon = agent.icon;

  const isComplete = events.some((e) => e.type === "complete");
  const isFailed = events.some((e) => e.type === "complete" && e.message.toLowerCase().includes("fail"));
  const lastEvent = events[events.length - 1];
  // The real purchase confirmation carries confirmationCardData (from the guardrail);
  // a plain action_required status frame does not.
  const guardrailCard = events.find(
    (e) => e.type === "action_required" && e.payload?.confirmationCardData,
  )?.payload?.confirmationCardData;
  const hasGuardrail = !!guardrailCard;

  // Append new agent messages in arrival order so the chat reads top→bottom,
  // interleaved correctly with the user's replies (which handleReply appends).
  const processedAgentCount = useRef(0);
  useEffect(() => {
    const agentMessages = events.filter((e) => e.type === "agent_message");
    if (agentMessages.length > processedAgentCount.current) {
      const fresh = agentMessages
        .slice(processedAgentCount.current)
        .map((e) => ({ role: "agent" as const, message: e.message }));
      processedAgentCount.current = agentMessages.length;
      setChatHistory((prev) => [...prev, ...fresh]);
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
    setChatHistory([]);
    processedAgentCount.current = 0;

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
  const isTerminal = isComplete || isFailed || guardrail === "dismissed";

  const statusBanner: { kind: "success" | "error"; message: string } | null = isFailed
    ? { kind: "error", message: lastEvent?.message ?? "Run failed" }
    : guardrail === "dismissed" && !isComplete
    ? { kind: "error", message: "Booking cancelled." }
    : isComplete
    ? { kind: "success", message: lastEvent?.message ?? "Task complete." }
    : null;

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
        /* Full-screen viewport when running — a live browser for browser-driven
           agents, or the generated report webpage for grocery-runner (no live
           browser exists for it: Walmart/Costco/Whole Foods have no public API
           and reliably block automated scraping). */
        <div className="relative min-h-0 flex-1">
          {agent.slug === "grocery-runner" ? (
            <GroceryReportView
              report={[...events].reverse().find((e) => e.payload?.groceryReport)?.payload?.groceryReport ?? null}
              runId={runId}
            />
          ) : (
            <ViewportPanel
              screenshotUrl={[...events].reverse().find((e) => e.payload?.screenshotUrl)?.payload?.screenshotUrl}
              liveViewUrl={[...events].reverse().find((e) => e.payload?.liveViewUrl)?.payload?.liveViewUrl}
              frozen={isTerminal}
              fullScreen
            />
          )}

          {/* Non-blocking terminal control — keeps the live browser/report visible */}
          {isTerminal && (
            <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
              <button
                onClick={() => { setRunPhase("idle"); setRunId(null); setGuardrail("pending"); setChatHistory([]); processedAgentCount.current = 0; }}
                className="btn-secondary-glass flex items-center gap-2 rounded-full border border-border/40 bg-obsidian/70 px-4 py-2 font-mono text-[11px] text-[var(--color-bone-dim)] backdrop-blur-md transition-colors hover:border-brass/25 hover:text-[var(--color-bone)]"
              >
                {isFailed || guardrail === "dismissed" ? <XCircle size={13} /> : <CircleCheck size={13} className="text-[var(--color-phosphor)]" />}
                New run
              </button>
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

      {/* ── Floating Chat (bottom-right) — the single surface for messages,
             the booking confirmation, and status ─────────────────────── */}
      {isRunning && (
        <FloatingAgentChat
          chatHistory={chatHistory}
          isWaitingForReply={isWaitingForReply && !hasGuardrail}
          onSendReply={handleReply}
          agentName={agent.name}
          agentAccent={agent.accent}
          guardrail={hasGuardrail && guardrailCard ? { title: guardrailCard.title, cost: guardrailCard.cost } : null}
          guardrailState={guardrail}
          onAuthorize={() => handleGuardrailConfirm("authorize")}
          onCancel={() => handleGuardrailConfirm("cancel")}
          statusBanner={statusBanner}
        />
      )}
    </div>
  );
}
