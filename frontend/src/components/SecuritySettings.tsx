import { ShieldCheck } from "lucide-react";

export function SecuritySettings() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto scroll-brass px-10 py-10">
      <header className="mb-8 flex flex-col gap-2 animate-rise">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
          Security Settings
        </span>
        <h1 className="font-display text-[32px] font-medium text-[var(--color-bone)]">
          Guardrail policy &amp; permissions.
        </h1>
        <p className="max-w-xl text-[14px] leading-relaxed text-[var(--color-bone-dim)]">
          Configure which actions require explicit authorization and manage agent permissions.
        </p>
      </header>

      <div className="flex flex-col items-center gap-3 py-16">
        <ShieldCheck size={28} className="text-[var(--color-bone-faint)]" />
        <p className="text-[14px] text-[var(--color-bone-dim)]">
          Security settings coming soon.
        </p>
        <p className="text-[12px] text-[var(--color-bone-faint)]">
          Guardrail policies and agent permissions will be configurable here.
        </p>
      </div>
    </div>
  );
}
