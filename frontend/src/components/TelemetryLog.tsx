import { useEffect, useRef } from "react";
import type { ITelemetryFrame } from "../lib/useRunStream";

interface LogRow {
  time: string;
  glyph: string;
  text: string;
  tone?: "phosphor" | "amber" | "coral";
}

// ── Fallback mock data (shown when no live events) ────────────────────────
const MOCK_ROWS: LogRow[] = [
  { time: "00:02", glyph: "🔍", text: "Hydrating engine with Information Commons data..." },
  { time: "00:04", glyph: "🧠", text: "Context combined. LLM requesting Browserbase invocation..." },
  { time: "00:05", glyph: "🌐", text: "Spawning headless Chrome node on browserbase platform..." },
  { time: "00:07", glyph: "🧭", text: "Navigating to expedia.com/checkout/seattle..." },
  { time: "00:09", glyph: "🛎️", text: "Applying saved preference: King bed, non-smoking, high floor." },
  { time: "00:11", glyph: "🏨", text: "Located candidate: The Paramount Hotel Seattle — $185.00/night", tone: "amber" },
  { time: "00:13", glyph: "🛑", text: "Guardrail interlock engaged. Awaiting operator authorization.", tone: "coral" },
];

// ── Frame type → visual mapping ───────────────────────────────────────────
const FRAME_META: Record<ITelemetryFrame["type"], { glyph: string; tone: LogRow["tone"] }> = {
  thinking:          { glyph: "🧠", tone: "phosphor" },
  tool_start:        { glyph: "🔧", tone: "amber" },
  viewport_update:   { glyph: "📸", tone: "phosphor" },
  action_required:   { glyph: "🛑", tone: "coral" },
  complete:          { glyph: "✅", tone: "phosphor" },
};

function frameToRow(frame: ITelemetryFrame, startTime: number): LogRow {
  const meta = FRAME_META[frame.type] ?? { glyph: "•", tone: "phosphor" };
  const elapsed = Math.max(0, Math.floor((new Date(frame.timestamp).getTime() - startTime) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return { time: `${mm}:${ss}`, glyph: meta.glyph, text: frame.message, tone: meta.tone };
}

const TONE_COLOR: Record<NonNullable<LogRow["tone"]>, string> = {
  phosphor: "var(--color-phosphor)",
  amber: "var(--color-amber-signal)",
  coral: "var(--color-coral-signal)",
};

// ── Component ─────────────────────────────────────────────────────────────
export function TelemetryLog({ events }: { events?: ITelemetryFrame[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive rows from live events, or fall back to mock
  const rows: LogRow[] = events && events.length > 0
    ? (() => {
        const startTime = new Date(events[0].timestamp).getTime();
        return events.map((f) => frameToRow(f, startTime));
      })()
    : MOCK_ROWS;

  // Auto-scroll on new rows
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [rows.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-[var(--color-hairline-strong)] bg-[#08110c]">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#0b1510] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-coral-signal)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--color-amber-signal)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--color-phosphor)]" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-phosphor-dim)]">
            Agent Telemetry Log
          </span>
        </div>
        <span className="font-mono text-[10px] text-[var(--color-phosphor-dim)]">
          {events && events.length > 0 ? `live · ${events.length} frames` : "mock preview"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="scroll-brass relative flex-1 overflow-y-auto px-4 py-4 font-mono text-[12.5px] leading-[1.9]"
      >
        {rows.map((row, i) => (
          <p
            key={i}
            className="animate-rise whitespace-pre-wrap"
            style={{ animationDelay: `${i * 0.12 + 0.2}s`, animationFillMode: "backwards" }}
          >
            <span className="text-[var(--color-phosphor-dim)]">[{row.time}]</span>{" "}
            <span>{row.glyph}</span>{" "}
            <span style={{ color: row.tone ? TONE_COLOR[row.tone] : "var(--color-phosphor)" }}>
              {row.text}
            </span>
          </p>
        ))}
        <span className="animate-flicker mt-1 inline-block h-[14px] w-[7px] bg-[var(--color-phosphor)] align-middle" />
      </div>
    </div>
  );
}
