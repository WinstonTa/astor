import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, CircleCheck, Loader2, XCircle, Send } from "lucide-react";
import type { Agent } from "../data/agents";
import { StatusRing } from "./StatusRing";
import { TelemetryLog } from "./TelemetryLog";
import { ViewportPanel } from "./ViewportPanel";
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

// Map run status from telemetry frames to a display status
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
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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
    } catch (err: any) {
      // If the API call fails, still update UI optimistically
      setGuardrail(decision === "authorize" ? "authorized" : "dismissed");
    }
  }, [runId]);

  const handleReply = useCallback(async () => {
    if (!runId || !reply.trim()) return;
    const userReply = reply.trim();
    setReply("");
    setChatHistory((prev) => [...prev, { role: "user", message: userReply }]);
    try {
      await replyToAgent(runId, userReply);
    } catch (err: any) {
      setError(err.message ?? "Failed to send reply");
    }
  }, [runId, reply]);

  // Derive display status from live events
  const displayStatus = runPhase === "running"
    ? deriveRunStatus(events)
    : runPhase === "starting" ? "running" as const
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

      {/* ── Chat interface ──────────────────────────────────────────── */}
      {runPhase === "running" && (chatHistory.length > 0 || isWaitingForReply) && (
        <div className="mb-5 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-panel)] p-4">
          <div className="max-h-48 overflow-y-auto space-y-3 mb-3">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-[10px] px-3 py-2 text-[13px] ${
                  msg.role === "user"
                    ? "bg-[var(--color-brass)] text-[#241a0c]"
                    : "bg-[var(--color-panel-raised)] text-[var(--color-bone)]"
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {isWaitingForReply && (
            <div className="flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
                placeholder="Type your reply..."
                className="flex-1 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-[var(--color-bone)] placeholder:text-[var(--color-bone-faint)] focus:border-[var(--color-brass)] focus:outline-none"
              />
              <button
                onClick={handleReply}
                disabled={!reply.trim()}
                className="flex items-center gap-1 rounded-[10px] bg-[var(--color-brass)] px-3 py-2 text-[12px] text-[#241a0c] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
        <TelemetryLog events={events} />
        <ViewportPanel screenshotUrl={events.find((e) => e.payload?.screenshotUrl)?.payload?.screenshotUrl} />

        {/* Guardrail modal */}
        {runPhase === "running" && hasGuardrail && guardrail === "pending" && !isComplete && (
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

        {/* Run complete overlay (non-guardrail) */}
        {isComplete && guardrail !== "authorized" && !hasGuardrail && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm">
            <div className="animate-rise flex flex-col items-center gap-3 rounded-[18px] border border-[var(--color-phosphor-dim)]/50 bg-[var(--color-panel-raised)] px-8 py-7 text-center">
              <CircleCheck size={28} className="text-[var(--color-phosphor)]" />
              <p className="font-display text-[17px] text-[var(--color-bone)]">
                {lastEvent?.message ?? "Task complete"}
              </p>
            </div>
          </div>
        )}

        {/* Failed overlay */}
        {isFailed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm">
            <div className="animate-rise flex flex-col items-center gap-3 rounded-[18px] border border-[var(--color-coral-signal)]/30 bg-[var(--color-panel-raised)] px-8 py-7 text-center">
              <XCircle size={28} className="text-[var(--color-coral-signal)]" />
              <p className="font-display text-[17px] text-[var(--color-bone)]">
                {lastEvent?.message ?? "Run failed"}
              </p>
              <button
                onClick={() => { setRunPhase("idle"); setRunId(null); setGuardrail("pending"); }}
                className="mt-2 rounded-[10px] border border-[var(--color-hairline)] px-4 py-2 font-mono text-[11px] text-[var(--color-bone-dim)] hover:text-[var(--color-bone)]"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* User-cancelled overlay */}
        {guardrail === "dismissed" && !isComplete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm">
            <div className="animate-rise flex flex-col items-center gap-3 rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-panel-raised)] px-8 py-7 text-center">
              <XCircle size={28} className="text-[var(--color-bone-dim)]" />
              <p className="font-display text-[17px] text-[var(--color-bone)]">
                Execution cancelled
              </p>
              <button
                onClick={() => { setRunPhase("idle"); setRunId(null); setGuardrail("pending"); }}
                className="mt-2 rounded-[10px] border border-[var(--color-hairline)] px-4 py-2 font-mono text-[11px] text-[var(--color-bone-dim)] hover:text-[var(--color-bone)]"
              >
                Run again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
