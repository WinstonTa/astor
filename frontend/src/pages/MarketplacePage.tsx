import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AppBackground } from "@/components/AppBackground";
import { Sidebar, type ViewId } from "@/components/Sidebar";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { CommonsView } from "@/components/CommonsView";
import { SecuritySettings } from "@/components/SecuritySettings";
import { UnifiedChatBar } from "@/components/UnifiedChatBar";
import { agents as fallbackAgents, mapApiAgent, type Agent } from "@/data/agents";
import { fetchAgents, startChat } from "@/lib/api";

export function MarketplacePage() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ViewId>("grid");
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents()
      .then((res) => {
        if (res.agents.length > 0) {
          setAgents(res.agents.map(mapApiAgent));
        }
      })
      .catch(() => {});
  }, []);

  const handleNavigate = (id: ViewId) => {
    setView(id);
  };

  const handleOpenAgent = (id: string) => {
    setLocation(`/agent/${id}`);
  };

  const handleChatSubmit = useCallback(async (message: string) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const userId = "00000000-0000-0000-0000-000000000001";
      const result = await startChat(userId, message);

      // Find or create the agent in our local list
      const existingAgent = agents.find((a) => a.slug === result.agent.slug);
      if (!existingAgent) {
        const newAgent = mapApiAgent(result.agent);
        setAgents((prev) => [...prev, newAgent]);
      }

      // Navigate to the agent with the run
      setLocation(`/agent/${result.agent.slug}?run=${result.runId}`);
    } catch (err: any) {
      setChatError(err.message ?? "Failed to process your request");
    } finally {
      setChatLoading(false);
    }
  }, [agents, setLocation]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 z-0">
        <AppBackground intensity="app" />
      </div>
      <div className="grain-field" />
      <Sidebar active={view} onNavigate={handleNavigate} />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        {view === "commons" ? (
          <CommonsView />
        ) : view === "security" ? (
          <SecuritySettings />
        ) : (
          <MarketplaceGrid agents={agents} onOpen={handleOpenAgent}>
            <UnifiedChatBar
              onSubmit={handleChatSubmit}
              isLoading={chatLoading}
              error={chatError}
            />
          </MarketplaceGrid>
        )}
      </main>
    </div>
  );
}
