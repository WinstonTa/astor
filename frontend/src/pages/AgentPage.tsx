import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { AppBackground } from "@/components/AppBackground";
import { ActiveAgentView } from "@/components/ActiveAgentView";
import { agents as fallbackAgents, mapApiAgent, type Agent } from "@/data/agents";
import { fetchAgents } from "@/lib/api";

export function AgentPage({ slug }: { slug: string }) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);

  // Get runId from query params if present
  const params = new URLSearchParams(search);
  const initialRunId = params.get("run");

  useEffect(() => {
    fetchAgents()
      .then((res) => {
        if (res.agents.length > 0) {
          setAgents(res.agents.map(mapApiAgent));
        }
      })
      .catch(() => {});
  }, []);

  const agent = agents.find((a) => a.slug === slug) ?? null;

  const handleBack = () => {
    setLocation("/marketplace");
  };

  if (!agent) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-background">
        <div className="pointer-events-none absolute inset-0 z-0">
          <AppBackground intensity="app" />
        </div>
        <div className="relative z-10 text-center">
          <h1 className="font-serif text-4xl font-medium italic text-bone">Agent not found</h1>
          <p className="mt-2 font-mono text-sm text-bone-dim">No agent with slug "{slug}"</p>
          <button
            onClick={handleBack}
            className="btn-primary-glass mt-6 rounded-xl px-6 py-2.5 font-mono text-xs text-primary-foreground"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 z-0">
        <AppBackground intensity="app" />
      </div>
      <div className="grain-field" />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <ActiveAgentView agent={agent} onBack={handleBack} initialRunId={initialRunId} />
      </main>
    </div>
  );
}
