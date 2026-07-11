import { Circle, MousePointer2 } from "lucide-react";

const RESULTS = [
  { name: "Hotel Ändra", price: "$212", tag: "Boutique" },
  { name: "The Paramount Hotel Seattle", price: "$185", tag: "Best match", highlight: true },
  { name: "Kimpton Palladian", price: "$229", tag: "Rooftop bar" },
];

export function ViewportPanel({ screenshotUrl, fullScreen }: { screenshotUrl?: string; fullScreen?: boolean }) {
  return (
    <div
      className={`glass-panel relative flex h-full flex-col overflow-hidden ${
        fullScreen ? "rounded-none" : "rounded-[18px]"
      }`}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-hairline bg-panel px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-bone-faint/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-bone-faint/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-bone-faint/20" />
        <div className="ml-2 flex-1 rounded-[6px] bg-obsidian px-3 py-1 font-mono text-[10px] text-bone-faint/60">
          {screenshotUrl ? "browserbase.live/session" : "expedia.com/hotels/seattle-wa/search?checkin=fri"}
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-coral-signal/15 bg-coral-signal/8 px-2 py-1">
          <Circle size={7} className="fill-[var(--color-coral-signal)] text-[var(--color-coral-signal)]" />
          <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--color-coral-signal)]">
            REC · REMOTE
          </span>
        </div>
      </div>

      {/* Content area */}
      <div className="relative flex-1 overflow-hidden bg-obsidian-2">
        {screenshotUrl ? (
          <div className="relative h-full w-full">
            <img
              src={screenshotUrl}
              alt="Live agent viewport"
              className="h-full w-full object-contain"
            />
            <div className="animate-scanline pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-[var(--color-phosphor)]/10 to-transparent" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 p-4">
              <div className="mb-1 h-2 w-40 rounded bg-[var(--color-bone-faint)]/20" />
              {RESULTS.map((r) => (
                <div
                  key={r.name}
                  className={`flex items-center gap-3 rounded-[10px] border p-2.5 transition-colors ${
                    r.highlight
                      ? "border-[var(--color-brass)]/60 bg-[var(--color-brass)]/10"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="h-12 w-16 shrink-0 rounded-[6px] bg-gradient-to-br from-[#3a3630] to-[#221f1b]" />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-[12px] font-medium text-[var(--color-bone)]">{r.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-bone-faint)]">
                      {r.tag}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[13px] ${
                      r.highlight ? "text-[var(--color-brass-bright)]" : "text-[var(--color-bone-dim)]"
                    }`}
                  >
                    {r.price}
                  </span>
                </div>
              ))}
            </div>

            <MousePointer2
              size={16}
              className="absolute text-[var(--color-brass-bright)] drop-shadow-[0_0_6px_rgba(232,185,106,0.8)]"
              style={{ top: "42%", left: "58%" }}
            />

            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(125,255,176,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(125,255,176,0.5) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="animate-scanline pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-[var(--color-phosphor)]/10 to-transparent" />
          </>
        )}
      </div>
    </div>
  );
}
