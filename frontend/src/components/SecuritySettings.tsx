import { ShieldCheck } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function SecuritySettings() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto scroll-brass px-8 py-10 sm:px-10">
      <PageHeader
        eyebrow="Security Settings"
        titleSerif="Guardrail policy"
        titleSans="& permissions."
        description="Configure which actions require explicit authorization and manage agent permissions."
      />

      <div className="glass-panel flex flex-col items-center gap-3 rounded-[18px] px-8 py-16">
        <ShieldCheck size={28} className="text-muted-foreground" />
        <p className="text-[14px] text-foreground/75">Security settings coming soon.</p>
        <p className="text-center text-[12px] text-muted-foreground">
          Guardrail policies and agent permissions will be configurable here.
        </p>
      </div>
    </div>
  );
}
