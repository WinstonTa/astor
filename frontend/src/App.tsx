import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PixelHero } from "@/components/ui/pixel-perfect-hero";
import { AppBackground } from "@/components/AppBackground";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { MarketplaceGrid } from "./components/MarketplaceGrid";
import { ActiveAgentView } from "./components/ActiveAgentView";
import { CommonsView } from "./components/CommonsView";
import { SecuritySettings } from "./components/SecuritySettings";
import { agents as fallbackAgents, mapApiAgent, type Agent } from "./data/agents";
import { fetchAgents } from "./lib/api";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>("grid");
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);

  useEffect(() => {
    fetchAgents()
      .then((res) => {
        if (res.agents.length > 0) {
          setAgents(res.agents.map(mapApiAgent));
        }
      })
      .catch(() => {});
  }, []);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  const handleNavigate = (id: ViewId) => {
    setView(id);
    setActiveAgentId(null);
  };

  const handleOpenAgent = (id: string) => {
    setActiveAgentId(id);
    setView("grid");
  };

  const handleBack = () => {
    setActiveAgentId(null);
  };

  if (showLanding) {
    return (
      <PixelHero
        word1="Agent"
        word2="Deck."
        description="A marketplace of specialist agents with isolated memory, live telemetry, and guardrails. Deploy your fleet and let each app handle what it does best."
        primaryCta="Open Marketplace"
        primaryCtaMobile="Open"
        secondaryCta="View GitHub"
        secondaryCtaMobile="GitHub"
        onPrimaryClick={() => setShowLanding(false)}
        githubUrl="https://github.com/WinstonTa/astor"
      />
    );
  }

  return (
    <div className="relative isolate flex h-screen w-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 z-0">
        <AppBackground intensity="app" />
      </div>
      <div className="grain-field" />
      <Sidebar active={activeAgentId ? "grid" : view} onNavigate={handleNavigate} />
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {activeAgent ? (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex h-full min-h-0 flex-col"
            >
              <ActiveAgentView agent={activeAgent} onBack={handleBack} />
            </motion.div>
          ) : view === "commons" ? (
            <motion.div
              key="commons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex h-full min-h-0 flex-col"
            >
              <CommonsView />
            </motion.div>
          ) : view === "security" ? (
            <motion.div
              key="security"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex h-full min-h-0 flex-col"
            >
              <SecuritySettings />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex h-full min-h-0 flex-col"
            >
              <MarketplaceGrid agents={agents} onOpen={handleOpenAgent} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
