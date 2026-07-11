import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { MarketplaceGrid } from "./components/MarketplaceGrid";
import { ActiveAgentView } from "./components/ActiveAgentView";
import { agents } from "./data/agents";

export default function App() {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  return (
    <div className="bg-mesh flex h-screen w-screen overflow-hidden">
      <div className="grain-field" />
      <Sidebar />
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
              <ActiveAgentView agent={activeAgent} onBack={() => setActiveAgentId(null)} />
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
              <MarketplaceGrid onOpen={setActiveAgentId} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
