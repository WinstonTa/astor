import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Loader2, Sparkles } from "lucide-react";

interface UnifiedChatBarProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  error: string | null;
  disabled?: boolean;
}

export function UnifiedChatBar({ onSubmit, isLoading, error, disabled }: UnifiedChatBarProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!value.trim() || isLoading || disabled) return;
    onSubmit(value.trim());
    setValue("");
  }, [value, isLoading, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="relative w-full">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        {/* Glow effect behind the input */}
        <div
          className="pointer-events-none absolute -inset-2 rounded-[20px] opacity-0 blur-[30px] transition-opacity duration-500"
          style={{
            opacity: isFocused ? 0.5 : 0,
            background: "radial-gradient(ellipse, rgba(204, 154, 78, 0.2) 0%, rgba(125, 255, 176, 0.05) 60%, transparent 80%)",
          }}
        />

        <div
          className={`relative flex items-center gap-3 rounded-[16px] border px-4 py-3.5 backdrop-blur-xl transition-all duration-400 ${
            isFocused
              ? "border-brass/30 shadow-[0_0_30px_rgba(204,154,78,0.1)]"
              : "border-border/20 hover:border-border/30"
          }`}
          style={{
            background: "linear-gradient(180deg, rgba(23, 21, 19, 0.6) 0%, rgba(23, 21, 19, 0.8) 100%)",
          }}
        >
          <Sparkles
            size={16}
            strokeWidth={1.4}
            className={`shrink-0 transition-colors duration-300 ${isFocused ? "text-brass" : "text-brass/40"}`}
          />

          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Try: &quot;Find a flight from LA to Tokyo under $800&quot; or &quot;Book a hotel in Austin this weekend&quot;"
            disabled={isLoading || disabled}
            className="flex-1 bg-transparent font-mono text-[13px] text-bone placeholder:text-bone-faint/40 outline-none disabled:opacity-50"
          />

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex shrink-0 items-center gap-2 text-brass/60"
              >
                <Loader2 size={14} className="animate-spin" />
                <span className="font-mono text-[10px] tracking-wider uppercase">
                  Routing...
                </span>
              </motion.div>
            ) : (
              <motion.button
                key="send"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-brass/15 text-brass transition-all duration-300 hover:bg-brass/25 hover:shadow-[0_0_16px_rgba(204,154,78,0.2)] disabled:opacity-30 disabled:hover:bg-brass/15 disabled:hover:shadow-none"
              >
                <Send size={14} strokeWidth={1.6} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2.5 flex items-center gap-1.5 px-1 font-mono text-[11px] text-coral-signal"
            >
              <span className="inline-block h-1 w-1 rounded-full bg-coral-signal" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
