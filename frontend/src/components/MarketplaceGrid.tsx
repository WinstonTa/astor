import { useEffect, useState } from "react";
import { AgentCard } from "./AgentCard";
import type { Agent } from "../data/agents";

export function MarketplaceGrid({ agents, onOpen }: { agents: Agent[]; onOpen: (id: string) => void }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scroll-brass">
      {/* Ambient header glow — mirrors the hero's radial atmosphere */}
      <div className="pointer-events-none relative mx-auto w-full max-w-5xl px-8 pt-14 pb-6 sm:px-10 sm:pt-20 sm:pb-10">
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 h-[420px] w-[700px] rounded-full opacity-40 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(204, 154, 78, 0.22) 0%, rgba(125, 255, 176, 0.06) 50%, transparent 80%)",
          }}
        />

        {/* Centered hero-style header */}
        <header
          className={`relative z-10 flex flex-col items-center text-center transition-all duration-1000 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span className="mb-4 text-[11px] font-medium tracking-[0.25em] text-primary/80 uppercase">
            Marketplace Grid
          </span>
          <h1 className="tahoe-glass-text flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-[2.4rem] leading-none sm:text-5xl md:text-6xl">
            <span className="font-serif font-medium italic">Your agent fleet,</span>
            <span className="font-sans font-extrabold tracking-tighter">at a glance.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed font-light text-foreground/75 sm:text-base">
            Each app is a specialist with its own tools and isolated memory, hydrated from your shared Information Commons on every run.
          </p>

          {/* Brass hairline divider — echoes the hero's polish */}
          <div className="mt-8 h-px w-40 bg-gradient-to-r from-transparent via-brass/30 to-transparent" />
        </header>
      </div>

      {/* Card grid with staggered entrance */}
      <div className="mx-auto w-full max-w-5xl px-8 pb-12 sm:px-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}
