import { useState } from "react";
import {
  LayoutGrid,
  BookOpenText,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export type ViewId = "grid" | "commons" | "security";

const NAV_ITEMS = [
  { id: "grid" as ViewId, label: "Marketplace Grid", sub: "Agent app repository", icon: LayoutGrid },
  { id: "commons" as ViewId, label: "Information Commons", sub: "Shared preferences", icon: BookOpenText },
  { id: "security" as ViewId, label: "Security Settings", sub: "Guardrail policy", icon: ShieldCheck },
];

export function Sidebar({
  active,
  onNavigate,
}: {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`glass-sidebar relative z-20 flex h-screen shrink-0 flex-col transition-[width] duration-300 ease-out ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      {/* Ambient top glow — subtle brass halo behind logo */}
      <div className="pointer-events-none absolute top-0 left-0 h-40 w-full overflow-hidden">
        <div
          className="absolute top-[-60px] left-1/2 h-[160px] w-[200px] -translate-x-1/2 rounded-full opacity-30 blur-[60px]"
          style={{ background: "radial-gradient(circle, rgba(204, 154, 78, 0.35), transparent 70%)" }}
        />
      </div>

      {/* Logo */}
      <div className="relative flex items-center gap-3 px-5 py-6">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-primary/30 bg-gradient-to-br from-primary to-[var(--color-brass-dim)] font-display text-lg font-medium text-primary-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_0_12px_rgba(204,154,78,0.15)]">
          A
        </div>
        {!collapsed && (
          <div className="animate-rise overflow-hidden">
            <p className="whitespace-nowrap font-display text-[17px] leading-none text-foreground">
              Astor
            </p>
            <p className="whitespace-nowrap font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Agent Deck
            </p>
          </div>
        )}
      </div>

      {/* Brass separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" />

      {/* Nav */}
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                isActive
                  ? "glass-panel border border-brass/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(204,154,78,0.06)]"
                  : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-brass to-brass-dim" />
              )}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-brass/10 text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
              </div>
              {!collapsed && (
                <span className="flex flex-col overflow-hidden whitespace-nowrap">
                  <span className={`text-[13px] leading-tight transition-colors ${isActive ? "text-foreground" : ""}`}>
                    {item.label}
                  </span>
                  <span className={`font-mono text-[10px] leading-tight transition-colors ${isActive ? "text-brass/60" : "text-muted-foreground/60"}`}>
                    {item.sub}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-3 pb-5">
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-hairline-strong to-transparent" />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="btn-secondary-glass flex w-full items-center justify-center gap-2 rounded-xl border border-border/30 py-2 text-muted-foreground transition-all duration-200 hover:border-brass/20 hover:text-foreground"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
