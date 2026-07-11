import { motion } from "motion/react";
import type { Agent } from "../data/agents";
import { StatusRing } from "./StatusRing";

export function AgentCard({
  agent,
  index,
  onOpen,
}: {
  agent: Agent;
  index: number;
  onOpen: (id: string) => void;
}) {
  const Icon = agent.icon;
  return (
    <motion.button
      onClick={() => onOpen(agent.id)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-panel)] p-5 text-left shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-colors hover:border-[var(--color-hairline-strong)]"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ backgroundColor: agent.accent }}
      />

      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[14px] border"
          style={{
            backgroundColor: `${agent.accent}14`,
            borderColor: `${agent.accent}33`,
          }}
        >
          <Icon size={22} strokeWidth={1.6} style={{ color: agent.accent }} />
        </div>
        <StatusRing status={agent.status} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[19px] font-medium leading-snug text-[var(--color-bone)]">
          {agent.name}
        </h3>
        <p className="text-[13px] leading-relaxed text-[var(--color-bone-dim)]">
          {agent.purpose}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-hairline)] pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-bone-faint)]">
          {agent.lastActive}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-bone-faint)] opacity-0 transition-opacity group-hover:opacity-100">
          Open →
        </span>
      </div>
    </motion.button>
  );
}
