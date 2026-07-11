import type { AgentStatus } from "../data/agents";

// Muted, realistic status colors that complement the new palette
const STATUS_META: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  idle: { color: "#8bbd8e", bg: "rgba(139, 189, 142, 0.06)", label: "IDLE" },
  running: { color: "#c9956b", bg: "rgba(201, 149, 107, 0.08)", label: "RUNNING" },
  attention: { color: "#c48f7a", bg: "rgba(196, 143, 122, 0.08)", label: "ATTENTION" },
};

export function StatusRing({ status }: { status: AgentStatus }) {
  const meta = STATUS_META[status];
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2 py-1"
      style={{
        backgroundColor: meta.bg,
        border: `1px solid ${meta.color}15`,
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
