import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, X, Check, TriangleAlert, CircleCheck, XCircle } from "lucide-react";
import { Markdown } from "./Markdown";

export interface GuardrailRequest {
  title: string;
  cost: string;
}

interface FloatingAgentChatProps {
  chatHistory: Array<{ role: "user" | "agent"; message: string }>;
  isWaitingForReply: boolean;
  onSendReply: (message: string) => void;
  agentName: string;
  agentAccent: string;
  /** When set, a purchase confirmation is pending and rendered inline in the chat. */
  guardrail?: GuardrailRequest | null;
  guardrailState?: "pending" | "authorized" | "dismissed" | null;
  onAuthorize?: () => void;
  onCancel?: () => void;
  /** Terminal run banner shown inline (non-blocking). */
  statusBanner?: { kind: "success" | "error"; message: string } | null;
}

export function FloatingAgentChat({
  chatHistory,
  isWaitingForReply,
  onSendReply,
  agentName,
  agentAccent,
  guardrail,
  guardrailState,
  onAuthorize,
  onCancel,
  statusBanner,
}: FloatingAgentChatProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const guardrailPending = !!guardrail && guardrailState === "pending";
  const needsAttention = isWaitingForReply || guardrailPending;

  // Auto-scroll on new content
  useEffect(() => {
    if (isOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isOpen, guardrailPending, statusBanner]);

  // Auto-open when the agent needs the user
  useEffect(() => {
    if (needsAttention && !isOpen) setIsOpen(true);
  }, [needsAttention]);

  const handleSend = () => {
    if (message.trim()) {
      onSendReply(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Panel */}
      {isOpen && (
        <div
          ref={chatRef}
          className="mb-3 w-[400px] max-w-[calc(100vw-3rem)]"
          style={{ animation: "chatPopIn 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" }}
        >
          <div className="relative flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-zinc-800/95 to-zinc-900/98 shadow-2xl backdrop-blur-3xl">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${agentAccent}20` }}
                >
                  <Bot size={14} style={{ color: agentAccent }} />
                </div>
                <span className="text-[13px] font-medium text-bone">{agentName}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-phosphor/10 px-2 py-0.5">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--color-phosphor)]" />
                  <span className="font-mono text-[9px] text-[var(--color-phosphor)]">LIVE</span>
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 transition-colors hover:bg-white/5"
                aria-label="Minimize chat"
              >
                <X size={14} className="text-bone-faint" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 scroll-brass">
              {chatHistory.length === 0 && !guardrailPending && (
                <p className="py-6 text-center text-[12px] text-bone-faint/50">
                  Agent messages will appear here
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-gradient-to-br from-brass to-brass-dim text-[12.5px] leading-relaxed text-primary-foreground shadow-[0_2px_8px_rgba(204,154,78,0.15)]"
                        : "rounded-bl-sm border border-border/30 bg-panel-raised"
                    }`}
                  >
                    {msg.role === "user" ? msg.message : <Markdown>{msg.message}</Markdown>}
                  </div>
                </div>
              ))}

              {/* Inline guardrail confirmation card */}
              {guardrailPending && (
                <div className="animate-rise overflow-hidden rounded-2xl border border-[var(--color-coral-signal)]/40 bg-black/30">
                  <div className="h-[3px] w-full bg-gradient-to-r from-[var(--color-coral-signal)] via-[var(--color-amber-signal)] to-[var(--color-coral-signal)]" />
                  <div className="flex flex-col gap-3 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-coral-signal)]/15">
                        <TriangleAlert size={13} className="text-[var(--color-coral-signal)]" />
                      </span>
                      <span className="text-[12.5px] font-medium text-bone">Confirm booking</span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-bone-dim">
                      Ready to book <span className="text-bone">{guardrail!.title}</span> for{" "}
                      <span className="font-mono text-brass-bright">{guardrail!.cost}</span>. This will
                      spend money — please authorize.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onCancel}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border/50 py-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X size={13} /> Cancel
                      </button>
                      <button
                        onClick={onAuthorize}
                        className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-medium text-primary-foreground transition-transform hover:brightness-110 active:scale-[0.98]"
                        style={{ background: `linear-gradient(135deg, ${agentAccent}, ${agentAccent}cc)` }}
                      >
                        <Check size={13} /> Authorize &amp; Book
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Terminal status banner */}
              {statusBanner && (
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] ${
                    statusBanner.kind === "success"
                      ? "border-phosphor/25 bg-phosphor/5 text-bone"
                      : "border-coral-signal/25 bg-coral-signal/5 text-bone"
                  }`}
                >
                  {statusBanner.kind === "success" ? (
                    <CircleCheck size={15} className="shrink-0 text-[var(--color-phosphor)]" />
                  ) : (
                    <XCircle size={15} className="shrink-0 text-[var(--color-coral-signal)]" />
                  )}
                  <span className="leading-snug">{statusBanner.message}</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-white/5 px-3 pb-3 pt-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isWaitingForReply ? "Reply to agent..." : "Send a message..."}
                  className="flex-1 rounded-xl border border-border/30 bg-obsidian/60 px-3.5 py-2.5 text-[12.5px] text-bone placeholder:text-bone-faint/40 outline-none transition-all duration-200 focus:border-brass/25 focus:shadow-[0_0_16px_rgba(204,154,78,0.06)]"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="flex items-center justify-center rounded-xl px-3.5 py-2.5 transition-all duration-200 hover:opacity-90 disabled:opacity-30"
                  style={{ background: `linear-gradient(135deg, ${agentAccent}, ${agentAccent}cc)` }}
                  aria-label="Send"
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        className={`floating-agent-btn relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-500 ${
          isOpen ? "scale-90" : "scale-100"
        }`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: `linear-gradient(135deg, ${agentAccent}cc, ${agentAccent}88)`,
          boxShadow: `0 0 20px ${agentAccent}70, 0 0 40px ${agentAccent}50, 0 0 60px ${agentAccent}30`,
          border: "2px solid rgba(255,255,255,0.15)",
        }}
        aria-label={isOpen ? "Minimize chat" : "Open chat"}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />
        <div className="relative z-10">
          {isOpen ? <X size={22} className="text-white" /> : <Bot size={22} className="text-white" />}
        </div>
        {!isOpen && needsAttention && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-phosphor)] opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--color-phosphor)]" />
          </span>
        )}
      </button>

      <style>{`
        @keyframes chatPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(16px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .floating-agent-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 0 30px ${agentAccent}90, 0 0 50px ${agentAccent}70, 0 0 70px ${agentAccent}50 !important;
        }
      `}</style>
    </div>
  );
}
