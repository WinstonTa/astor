import { Switch, Route, useLocation } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { PixelHero } from "@/components/ui/pixel-perfect-hero";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { AgentPage } from "@/pages/AgentPage";

export default function App() {
  const [location, setLocation] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Switch location={location}>
        {/* Landing page */}
        <Route path="/">
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PixelHero
              word1="Agent"
              word2="Deck."
              description="A marketplace of specialist agents with isolated memory, live telemetry, and guardrails. Deploy your fleet and let each app handle what it does best."
              primaryCta="Open Marketplace"
              primaryCtaMobile="Open"
              secondaryCta="View GitHub"
              secondaryCtaMobile="GitHub"
              onPrimaryClick={() => setLocation("/marketplace")}
              githubUrl="https://github.com/WinstonTa/astor"
            />
          </motion.div>
        </Route>

        {/* Marketplace grid */}
        <Route path="/marketplace">
          <motion.div
            key="marketplace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <MarketplacePage />
          </motion.div>
        </Route>

        {/* Individual agent page */}
        <Route path="/agent/:slug">
          {(params) => (
            <motion.div
              key={`agent-${params.slug}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <AgentPage slug={params.slug} />
            </motion.div>
          )}
        </Route>

        {/* 404 fallback */}
        <Route>
          <motion.div
            key="not-found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-screen items-center justify-center bg-background"
          >
            <div className="text-center">
              <h1 className="font-serif text-6xl font-medium italic text-bone">404</h1>
              <p className="mt-2 font-mono text-sm text-bone-dim">Page not found</p>
              <button
                onClick={() => setLocation("/marketplace")}
                className="btn-primary-glass mt-6 rounded-xl px-6 py-2.5 font-mono text-xs text-primary-foreground"
              >
                Back to Marketplace
              </button>
            </div>
          </motion.div>
        </Route>
      </Switch>
    </AnimatePresence>
  );
}
