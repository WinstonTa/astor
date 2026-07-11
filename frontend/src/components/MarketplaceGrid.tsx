import { useEffect, useState } from "react";
import { agents as fallbackAgents, mapApiAgent, type Agent } from "../data/agents";
import { fetchAgents } from "../lib/api";
import { AgentCard } from "./AgentCard";

export function MarketplaceGrid({ onOpen }: { onOpen: (id: string) => void }) {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);

  useEffect(() => {
    fetchAgents()
      .then((res) => {
        if (res.agents.length > 0) {
          setAgents(res.agents.map(mapApiAgent));
        }
      })
      .catch(() => {
        // Backend unavailable — keep fallback mock data
      });
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scroll-brass px-10 py-10">
      <header className="mb-8 flex flex-col gap-2 animate-rise">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
          Marketplace Grid
        </span>
        <h1 className="font-display text-[32px] font-medium text-[var(--color-bone)]">
          Your agent fleet, at a glance.
        </h1>
        <p className="max-w-xl text-[14px] leading-relaxed text-[var(--color-bone-dim)]">
          Each app is a specialist with its own tools and isolated memory, hydrated
          from your shared Information Commons on every run.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
