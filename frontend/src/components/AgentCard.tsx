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
      className="glass-panel glass-panel-hover group relative flex flex-col gap-5 overflow-hidden rounded-[20px] p-5 text-left transition-all duration-300"
    >
      {/* Glass top-edge reflection */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Accent glow — appears on hover */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
        style={{ backgroundColor: agent.accent }}
      />

      {/* Faint accent bottom bar */}
      <div
        className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${agent.accent}40, transparent)` }}
      />

      <div className="flex items-start justify-between">
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-[14px] border backdrop-blur-sm transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(204,154,78,0.12)]"
          style={{
            backgroundColor: `${agent.accent}10`,
            borderColor: `${agent.accent}28`,
          }}
        >
          <Icon size={22} strokeWidth={1.6} style={{ color: agent.accent }} />
          {/* Subtle inner glow on icon container */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[14px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: `inset 0 0 12px ${agent.accent}10` }}
          />
        </div>
        <StatusRing status={agent.status} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[19px] leading-snug font-medium text-foreground transition-colors group-hover:text-bone">
          {agent.name}
        </h3>
        <p className="text-[13px] leading-relaxed text-foreground/65 group-hover:text-foreground/75 transition-colors">
          {agent.purpose}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70 uppercase">
          {agent.lastActive}
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-primary opacity-0 transition-all duration-200 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0">
          Open
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </motion.button>
  );
}
