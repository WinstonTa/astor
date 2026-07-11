import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Download, FileDown, MapPin, UtensilsCrossed, Receipt, Loader2, ShoppingBasket } from "lucide-react";
import type { IGroceryReport } from "../lib/useRunStream";
import { downloadHtmlFile } from "../lib/groceryReportHtml";

const EASE = [0.16, 1, 0.3, 1] as const;

// `forceVisible` bypasses scroll-triggered reveal entirely (used right before a
// PNG capture): whileInView only ever fires for content that has actually been
// scrolled past in the real viewport, so a screenshot taken without scrolling
// would otherwise freeze everything below the fold at its pre-reveal, opacity-0
// state — exactly what "the PNG should include everything, statically
// represented" rules out.
function LedgerRow({
  label,
  value,
  delay,
  forceVisible,
}: {
  label: string;
  value: string;
  delay: number;
  forceVisible: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={forceVisible ? { opacity: 1, y: 0 } : undefined}
      whileInView={forceVisible ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      // Forced capture snaps instantly (duration 0) — no stagger delay to wait out.
      transition={forceVisible ? { duration: 0 } : { duration: 0.5, delay, ease: EASE }}
      className="flex items-baseline gap-3 border-b border-hairline py-[18px] last:border-b-0"
    >
      <span className="whitespace-nowrap font-mono text-[10.5px] tracking-[0.14em] text-bone-faint uppercase">
        {label}
      </span>
      <span className="-translate-y-1 flex-1 border-b border-dotted border-hairline-strong" />
      <span className="max-w-[60%] text-right font-display text-[16px] text-bone">{value}</span>
    </motion.div>
  );
}

function ItemCard({
  item,
  index,
  forceVisible,
}: {
  item: IGroceryReport["items"][number];
  index: number;
  forceVisible: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={forceVisible ? { opacity: 1, y: 0 } : undefined}
      whileInView={forceVisible ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      // Forced capture snaps instantly (duration 0) — no stagger delay to wait out.
      transition={forceVisible ? { duration: 0 } : { duration: 0.55, delay: (index % 8) * 0.05, ease: EASE }}
      className="glass-panel glass-panel-hover group overflow-hidden rounded-[16px]"
    >
      <div className="aspect-[4/3] overflow-hidden bg-obsidian-2">
        <img
          src={item.imageUrl}
          alt={item.itemName}
          crossOrigin="anonymous"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <div className="px-4 pt-3.5 pb-4">
        <h3 className="text-[13.5px] leading-snug font-medium text-bone">{item.itemName}</h3>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="font-mono text-[14px] text-brass-bright">{item.estimatedPriceDisplay}</span>
          {item.sizeDisplay && (
            <span className="font-mono text-[10px] tracking-[0.08em] text-bone-faint uppercase">
              {item.sizeDisplay}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-16 mb-5 flex items-center gap-3 first:mt-0">
      <span className="font-mono text-[10.5px] tracking-[0.18em] text-bone-faint uppercase">{children}</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

export function GroceryReportView({ report, runId }: { report: IGroceryReport | null; runId: string | null }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  // Forces every scroll-reveal card/row to its final visible state right
  // before a PNG capture, then reverts — see the ItemCard/LedgerRow comment.
  const [forceVisible, setForceVisible] = useState(false);

  const handleDownloadPng = async () => {
    if (!contentRef.current || exporting) return;
    setExporting(true);
    try {
      setForceVisible(true);
      // Let React re-render with the forced-visible state and Motion apply it,
      // and make sure every image has actually finished loading — otherwise a
      // fast click right after the report appears can capture blank tiles.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const imgs = Array.from(contentRef.current.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );

      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: "#0b0a09",
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const slug = (report?.tripTheme || "grocery-report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        a.href = url;
        a.download = `${slug || "grocery-report"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setForceVisible(false);
      setExporting(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!report) return;
    downloadHtmlFile(report);
  };

  // ── Waiting for the report ────────────────────────────────────────────
  if (!report) {
    return (
      <div className="glass-panel relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-none">
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-mesh" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-brass/25 bg-brass/8">
            <ShoppingBasket size={22} strokeWidth={1.5} className="text-brass-bright" />
            <span className="absolute inset-0 animate-pulse-ring rounded-full border border-brass-bright" />
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-bone-faint uppercase">
            <Loader2 size={12} className="animate-spin" />
            Compiling grocery report
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-brass relative h-full w-full overflow-y-auto rounded-none bg-obsidian">
      <div className="pointer-events-none fixed inset-0 opacity-50 bg-mesh" />

      <div ref={contentRef} className="relative mx-auto max-w-[1080px] px-7 pt-14 pb-10 sm:px-10">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center gap-2.5 font-mono text-[10.5px] tracking-[0.18em] text-brass-bright uppercase">
            <span className="h-px w-5 bg-brass-bright" />
            Grocery Report
            {runId && <span className="text-bone-faint/60">· Session {runId.slice(0, 8)}</span>}
          </div>
          <h1 className="mt-4 font-display text-[42px] leading-[1.02] font-medium text-bone italic sm:text-[62px]">
            {report.tripTheme || "Your Grocery Run"}
          </h1>
          {report.narrative && (
            <p className="mt-5 max-w-[620px] border-l-2 border-brass py-0.5 pl-5 font-display text-[17px] leading-relaxed text-bone-dim italic sm:text-[19px]">
              "{report.narrative}"
            </p>
          )}
          <p className="mt-3 font-mono text-[10.5px] tracking-[0.06em] text-bone-faint/70">
            Estimates only — no live store pricing was available for this run.
          </p>
        </motion.div>

        {/* ── Item grid ────────────────────────────────────────────────── */}
        <SectionLabel>Shopping List · {report.items.length} items</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {report.items.map((item, i) => (
            <ItemCard key={`${item.itemName}-${i}`} item={item} index={i} forceVisible={forceVisible} />
          ))}
        </div>

        {/* ── Fun facts / ledger ───────────────────────────────────────── */}
        <SectionLabel>Field Notes</SectionLabel>
        <div className="glass-panel rounded-[16px] px-5 sm:px-7">
          <LedgerRow label="Estimated total" value={report.estimatedTotalDisplay} delay={0} forceVisible={forceVisible} />
          <LedgerRow
            label="Best stores"
            value={report.bestStores.length ? report.bestStores.join(" · ") : "—"}
            delay={0.06}
            forceVisible={forceVisible}
          />
          <LedgerRow
            label="Related meals"
            value={report.relatedMeals.length ? report.relatedMeals.join(", ") : "—"}
            delay={0.12}
            forceVisible={forceVisible}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={forceVisible ? { opacity: 1 } : undefined}
          whileInView={forceVisible ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={forceVisible ? { duration: 0 } : { duration: 0.6, delay: 0.15 }}
          className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-bone-faint"
        >
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase">
            <MapPin size={12} className="text-brass-bright" /> {report.bestStores.length} store{report.bestStores.length === 1 ? "" : "s"} suggested
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase">
            <UtensilsCrossed size={12} className="text-brass-bright" /> {report.relatedMeals.length} related meal ideas
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase">
            <Receipt size={12} className="text-brass-bright" /> {report.items.length} items itemized
          </span>
        </motion.div>
      </div>

      {/* ── Actions (outside the exported/captured content) ─────────────── */}
      <div className="relative mx-auto flex max-w-[1080px] flex-col items-center gap-3 px-7 pb-16 sm:flex-row sm:justify-center sm:pb-20">
        <button
          onClick={handleDownloadHtml}
          className="btn-secondary-glass flex items-center gap-2 rounded-[12px] border border-border/40 px-5 py-3 font-mono text-[11px] tracking-[0.12em] text-bone-dim uppercase transition-all duration-200 hover:border-brass/25 hover:text-bone"
        >
          <FileDown size={14} />
          Save as HTML
        </button>
        <button
          onClick={handleDownloadPng}
          disabled={exporting}
          className="btn-primary-glass flex items-center gap-2 rounded-[12px] px-5 py-3 font-mono text-[11px] tracking-[0.12em] text-primary-foreground uppercase transition-all duration-200 hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {exporting ? "Rendering..." : "Download as PNG"}
        </button>
      </div>
    </div>
  );
}
