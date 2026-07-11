import { useState } from "react";
import {
  LayoutGrid,
  BookOpenText,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "grid", label: "Marketplace Grid", sub: "Agent app repository", icon: LayoutGrid },
  { id: "commons", label: "Information Commons", sub: "Shared preferences", icon: BookOpenText },
  { id: "security", label: "Security Settings", sub: "Guardrail policy", icon: ShieldCheck },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<string>("grid");

  return (
    <aside
      className={`relative flex h-screen shrink-0 flex-col border-r border-[var(--color-hairline)] bg-[var(--color-obsidian-2)] transition-[width] duration-300 ease-out ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-hairline-strong)] bg-gradient-to-br from-[var(--color-brass)] to-[var(--color-brass-dim)] font-display text-lg font-medium text-[var(--color-obsidian)]">
          A
        </div>
        {!collapsed && (
          <div className="animate-rise overflow-hidden">
            <p className="whitespace-nowrap font-display text-[17px] leading-none text-[var(--color-bone)]">
              Astor
            </p>
            <p className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-bone-faint)]">
              Agent Deck
            </p>
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-[var(--color-panel-raised)] text-[var(--color-bone)]"
                  : "text-[var(--color-bone-dim)] hover:bg-[var(--color-panel)] hover:text-[var(--color-bone)]"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[var(--color-brass-bright)]" />
              )}
              <Icon
                size={18}
                strokeWidth={1.75}
                className={isActive ? "text-[var(--color-brass-bright)]" : ""}
              />
              {!collapsed && (
                <span className="flex flex-col overflow-hidden whitespace-nowrap">
                  <span className="text-[13px] leading-tight">{item.label}</span>
                  <span className="font-mono text-[10px] leading-tight text-[var(--color-bone-faint)]">
                    {item.sub}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-5">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--color-hairline)] py-2 text-[var(--color-bone-faint)] transition-colors hover:border-[var(--color-hairline-strong)] hover:text-[var(--color-bone)]"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
