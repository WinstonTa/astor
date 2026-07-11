import { motion } from "motion/react";
import type { Agent } from "../data/agents";
import { StarRating } from "./StarRating";

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      className="group relative rounded-[18px] text-left transition-all duration-300"
    >
      {/* Subtle border glow on hover */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[19px] opacity-0 blur-[1px] transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${agent.accent}20, transparent 50%, ${agent.accent}10)`,
        }}
      />

      <div className="glass-panel relative flex h-full flex-col gap-4 overflow-hidden rounded-[18px] p-5 transition-all duration-400 group-hover:border-white/[0.12] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
        {/* Top-edge glass reflection */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* Accent glow — appears on hover */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-[50px] transition-all duration-600 group-hover:opacity-[0.1]"
          style={{ backgroundColor: agent.accent }}
        />

        {/* Bottom accent line */}
        <div
          className="pointer-events-none absolute inset-x-5 bottom-0 h-[1.5px] rounded-full opacity-0 transition-all duration-500 group-hover:opacity-40"
          style={{ background: `linear-gradient(90deg, transparent, ${agent.accent}60, transparent)` }}
        />

        {/* Header: Icon + Rating */}
        <div className="flex items-start justify-between">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[12px] border transition-all duration-400"
            style={{
              backgroundColor: `${agent.accent}0a`,
              borderColor: `${agent.accent}18`,
            }}
          >
            <Icon size={20} strokeWidth={1.6} style={{ color: agent.accent }} />
          </div>
          <StarRating agentId={agent.id} />
        </div>

        {/* Content — landing page font style */}
        <div className="flex flex-col gap-1.5">
          <h3 className="font-serif text-[18px] leading-snug font-medium italic text-bone transition-colors duration-300 group-hover:text-white">
            {agent.name}
          </h3>
          <p className="text-[12.5px] leading-relaxed font-light text-bone-dim/60 transition-colors duration-300 group-hover:text-bone-dim/80 line-clamp-2">
            {agent.purpose}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border/25 pt-3">
          <span className="font-mono text-[10px] tracking-[0.12em] text-bone-faint/50 uppercase">
            {agent.lastActive}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] text-brass/60 opacity-0 transition-all duration-300 group-hover:opacity-100 translate-x-1.5 group-hover:translate-x-0">
            Open
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2.5L6.5 5L3.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </motion.button>
  );
}
