import type { AgentStatus } from "../data/agents";

const STATUS_META: Record<AgentStatus, { color: string; label: string }> = {
  idle: { color: "#7dffb0", label: "IDLE" },
  running: { color: "#f5a623", label: "RUNNING" },
  attention: { color: "#ff5c4d", label: "ATTENTION" },
};

export function StatusRing({ status }: { status: AgentStatus }) {
  const meta = STATUS_META[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {status !== "idle" && (
          <span
            className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full"
            style={{ color: meta.color, backgroundColor: meta.color }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
      </span>
      <span
        className="font-mono text-[10px] tracking-[0.18em]"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </div>
  );
}
