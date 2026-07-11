import { useState } from "react";
import { ArrowLeft, CircleCheck } from "lucide-react";
import type { Agent } from "../data/agents";
import { StatusRing } from "./StatusRing";
import { TelemetryLog } from "./TelemetryLog";
import { ViewportPanel } from "./ViewportPanel";
import { GuardrailModal } from "./GuardrailModal";

type GuardrailState = "pending" | "authorized" | "dismissed";

export function ActiveAgentView({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [guardrail, setGuardrail] = useState<GuardrailState>("pending");
  const Icon = agent.icon;

  return (
    <div className="flex h-full flex-1 flex-col px-10 py-8">
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
              Session · run_id 8f2a-hb-441
            </p>
          </div>
        </div>
        <StatusRing status={guardrail === "authorized" ? "idle" : agent.status} />
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
        <TelemetryLog />
        <ViewportPanel />

        <GuardrailModal
          open={guardrail === "pending"}
          onCancel={() => setGuardrail("dismissed")}
          onAuthorize={() => setGuardrail("authorized")}
        />

        {guardrail === "authorized" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm">
            <div className="animate-rise flex flex-col items-center gap-3 rounded-[18px] border border-[var(--color-phosphor-dim)]/50 bg-[var(--color-panel-raised)] px-8 py-7 text-center">
              <CircleCheck size={28} className="text-[var(--color-phosphor)]" />
              <p className="font-display text-[17px] text-[var(--color-bone)]">
                Booking confirmed
              </p>
              <p className="max-w-[240px] text-[12.5px] text-[var(--color-bone-dim)]">
                Episodic memory will store this transaction for future Hotel Booker runs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
