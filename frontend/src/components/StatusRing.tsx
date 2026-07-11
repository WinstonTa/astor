import type { AgentStatus } from "../data/agents";

const STATUS_META: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  idle: { color: "#7dffb0", bg: "rgba(125, 255, 176, 0.08)", label: "IDLE" },
  running: { color: "#f5a623", bg: "rgba(245, 166, 35, 0.08)", label: "RUNNING" },
  attention: { color: "#ff5c4d", bg: "rgba(255, 92, 77, 0.08)", label: "ATTENTION" },
};

export function StatusRing({ status }: { status: AgentStatus }) {
  const meta = STATUS_META[status];
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2 py-1"
      style={{
        backgroundColor: meta.bg,
        border: `1px solid ${meta.color}18`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {status !== "idle" && (
          <span
            className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full"
            style={{ color: meta.color, backgroundColor: meta.color }}
          />
        )}
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
      </span>
      <span
        className="font-mono text-[9px] tracking-[0.18em]"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </div>
  );
}
