import { useEffect, useState } from "react";
import { Brain, Wrench, Camera, StopCircle, CheckCircle2, MessageCircle } from "lucide-react";
import type { ITelemetryFrame } from "../lib/useRunStream";

const FRAME_ICON: Record<ITelemetryFrame["type"], React.ComponentType<{ size?: number; className?: string }>> = {
  thinking: Brain,
  tool_start: Wrench,
  viewport_update: Camera,
  action_required: StopCircle,
  complete: CheckCircle2,
  agent_message: MessageCircle,
};

const FRAME_TONE: Record<ITelemetryFrame["type"], string> = {
  thinking: "var(--color-phosphor)",
  tool_start: "var(--color-amber-signal)",
  viewport_update: "var(--color-phosphor)",
  action_required: "var(--color-coral-signal)",
  complete: "var(--color-phosphor)",
  agent_message: "var(--color-phosphor)",
};

export function TelemetryStatusBar({ events }: { events: ITelemetryFrame[] }) {
  const [dots, setDots] = useState("");

  // Animate dots while agent is running
  useEffect(() => {
    const last = events[events.length - 1];
    const isActive = !last || (last.type !== "complete" && last.type !== "action_required");
    if (!isActive) return;

    const iv = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(iv);
  }, [events]);

  const last = events[events.length - 1];
  if (!last) {
    return (
      <div className="flex items-center gap-2.5 rounded-full border border-brass/15 bg-obsidian/70 px-4 py-2 backdrop-blur-xl">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-phosphor)]" />
        <span className="font-mono text-[11px] tracking-wide text-bone-dim">
          Agent initializing{dots}
        </span>
      </div>
    );
  }

  const Icon = FRAME_ICON[last.type] ?? Brain;
  const tone = FRAME_TONE[last.type] ?? "var(--color-phosphor)";
  const isDone = last.type === "complete";
  const isFailed = last.type === "complete" && last.message.toLowerCase().includes("fail");

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-brass/15 bg-obsidian/70 px-4 py-2 backdrop-blur-xl transition-all duration-300">
      <div
        className={`h-1.5 w-1.5 rounded-full ${isDone ? "" : "animate-pulse"}`}
        style={{ backgroundColor: isFailed ? "var(--color-coral-signal)" : tone }}
      />
      <Icon size={13} style={{ color: tone }} className="shrink-0" />
      <span
        className="max-w-[420px] truncate font-mono text-[11px] tracking-wide"
        style={{ color: isFailed ? "var(--color-coral-signal)" : tone }}
      >
        {last.message}{!isDone && !isFailed ? dots : ""}
      </span>
      {events.length > 1 && (
        <span className="ml-1 font-mono text-[9px] text-bone-faint/40">
          {events.length} events
        </span>
      )}
    </div>
  );
}
