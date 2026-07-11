import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AgentCard } from "./AgentCard";
import type { Agent } from "../data/agents";

export function MarketplaceGrid({ agents, onOpen, children }: { agents: Agent[]; onOpen: (id: string) => void; children?: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scroll-brass">
      {/* Header — matches landing page typography */}
      <div className="pointer-events-none relative mx-auto w-full max-w-5xl px-6 pt-12 pb-4 sm:px-8 sm:pt-16 sm:pb-6">
        <header
          className={`relative z-10 flex flex-col items-center text-center transition-all duration-1000 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span className="mb-4 font-mono text-[10px] tracking-[0.25em] text-brass/50 uppercase">
            Agent Marketplace
          </span>

          {/* Title — same style as landing page */}
          <h1 className="tahoe-glass-text flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-[2.2rem] leading-none sm:text-5xl md:text-[3.5rem]">
            <span className="font-serif font-medium italic">Your agent fleet,</span>
            <span className="font-sans font-extrabold tracking-tighter">at a glance.</span>
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed font-light text-foreground/75 sm:text-base">
            Each agent is a specialist with isolated memory and live telemetry.
          </p>

          <div className="mt-6 h-px w-32 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        </header>
      </div>

      {/* Chat bar */}
      <div className="relative z-20 mx-auto w-full max-w-2xl px-6 pb-8 sm:px-8">
        {children}
      </div>

      {/* Card grid */}
      <div className="mx-auto w-full px-6 pb-16 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[960px]:grid-cols-3">
          {agents.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}
