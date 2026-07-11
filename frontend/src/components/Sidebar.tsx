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
  { id: "grid" as ViewId, label: "Marketplace", sub: "Agent repository", icon: LayoutGrid },
  { id: "commons" as ViewId, label: "Commons", sub: "Shared preferences", icon: BookOpenText },
  { id: "security" as ViewId, label: "Security", sub: "Guardrail policy", icon: ShieldCheck },
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
      {/* Logo */}
      <div className="relative flex items-center gap-3 px-5 py-6">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-brass/20 bg-gradient-to-br from-brass/80 to-brass-dim font-serif text-lg font-medium italic text-primary-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
          A
        </div>
        {!collapsed && (
          <div className="animate-rise overflow-hidden">
            <p className="whitespace-nowrap font-serif text-[17px] leading-none font-medium italic text-foreground">
              Astor
            </p>
            <p className="whitespace-nowrap font-mono text-[10px] tracking-[0.16em] text-bone-faint/60 uppercase">
              Agent Deck
            </p>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />

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
                  ? "glass-panel border border-brass/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  : "hover:bg-white/[0.02]"
              }`}
            >
              {isActive && (
                <span className="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-brass/80 to-brass-dim/60" />
              )}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                  isActive
                    ? "text-brass"
                    : "text-bone-faint/50 group-hover:text-bone-dim"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
              </div>
              {!collapsed && (
                <span className="flex flex-col overflow-hidden whitespace-nowrap">
                  <span className={`font-serif text-[13px] leading-tight font-medium italic transition-colors ${isActive ? "text-bone" : "text-bone-dim/70 group-hover:text-bone-dim"}`}>
                    {item.label}
                  </span>
                  <span className={`font-mono text-[10px] leading-tight transition-colors ${isActive ? "text-brass/50" : "text-bone-faint/40"}`}>
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
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/20 py-2 text-bone-faint/50 transition-all duration-200 hover:border-border/30 hover:text-bone-dim"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
