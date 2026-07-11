import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { MarketplaceGrid } from "./components/MarketplaceGrid";
import { ActiveAgentView } from "./components/ActiveAgentView";
import { CommonsView } from "./components/CommonsView";
import { SecuritySettings } from "./components/SecuritySettings";
import { agents } from "./data/agents";

export default function App() {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>("grid");
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  const handleNavigate = (id: ViewId) => {
    setView(id);
    setActiveAgentId(null); // close agent view when navigating
  };

  const handleOpenAgent = (id: string) => {
    setActiveAgentId(id);
    setView("grid"); // ensure we're on grid view context
  };

  const handleBack = () => {
    setActiveAgentId(null);
  };

  return (
    <div className="bg-mesh flex h-screen w-screen overflow-hidden">
      <div className="grain-field" />
      <Sidebar active={activeAgentId ? "grid" : view} onNavigate={handleNavigate} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {activeAgent ? (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col"
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
              className="flex h-full flex-col"
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
              className="flex h-full flex-col"
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
              className="flex h-full flex-col"
            >
              <MarketplaceGrid onOpen={handleOpenAgent} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
