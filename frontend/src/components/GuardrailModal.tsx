import { motion, AnimatePresence } from "motion/react";
import { TriangleAlert, X, Check } from "lucide-react";

export function GuardrailModal({
  open,
  runId,
  payload,
  onCancel,
  onAuthorize,
}: {
  open: boolean;
  runId?: string | null;
  payload?: { screenshotUrl?: string; confirmationCardData?: { title: string; cost: string } };
  onCancel: () => void;
  onAuthorize: () => void;
}) {
  const title = payload?.confirmationCardData?.title ?? "The Paramount Hotel Seattle";
  const cost = payload?.confirmationCardData?.cost ?? "$185.00";
  const displayRunId = runId ? runId.slice(0, 8) : "8f2a-hb-441";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-[#050403]/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-6 w-full max-w-md overflow-hidden rounded-[18px] border border-[var(--color-coral-signal)]/40 bg-[var(--color-panel-raised)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
          >
            <div className="h-[3px] w-full bg-gradient-to-r from-[var(--color-coral-signal)] via-[var(--color-amber-signal)] to-[var(--color-coral-signal)]" />

            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-coral-signal)]/15">
                  <TriangleAlert size={16} className="text-[var(--color-coral-signal)]" />
                </span>
                <h2 className="font-display text-[18px] font-medium text-[var(--color-bone)]">
                  Action Authorization Required
                </h2>
              </div>

              <p className="text-[13.5px] leading-relaxed text-[var(--color-bone-dim)]">
                Agent is ready to book{" "}
                <span className="text-[var(--color-bone)]">{title}</span> for{" "}
                <span className="font-mono text-[var(--color-brass-bright)]">{cost}</span> using
                your saved profile metadata.
              </p>

              <div className="flex items-center justify-between rounded-[10px] border border-[var(--color-hairline)] bg-black/20 px-3.5 py-2.5 font-mono text-[11px] text-[var(--color-bone-faint)]">
                <span>run_id · {displayRunId}</span>
                <span className="text-[var(--color-amber-signal)]">AWAITING_CONFIRMATION</span>
              </div>

              <div className="mt-1 flex flex-col-reverse gap-2.5 sm:flex-row">
                <button
                  onClick={onCancel}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--color-hairline-strong)] py-2.5 text-[12.5px] text-[var(--color-bone-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--color-bone)]"
                >
                  <X size={14} />
                  Cancel Execution Loop
                </button>
                <button
                  onClick={onAuthorize}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[var(--color-brass-bright)] to-[var(--color-brass)] py-2.5 text-[12.5px] font-medium text-[#241a0c] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset] transition-transform hover:brightness-105 active:scale-[0.98]"
                >
                  <Check size={14} />
                  Authorize &amp; Confirm Purchase
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
