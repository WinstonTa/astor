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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Chat Panel */}
      {isOpen && (
        <div
          ref={chatRef}
          className="mb-3 w-[400px] max-w-[calc(100vw-3rem)]"
          style={{ animation: "chatPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" }}
        >
          <div className="glass-panel relative flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-brass/15 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            {/* Top-edge glass reflection */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-[10px] border backdrop-blur-sm"
                  style={{
                    backgroundColor: `${agentAccent}12`,
                    borderColor: `${agentAccent}25`,
                  }}
                >
                  <Bot size={15} style={{ color: agentAccent }} />
                </div>
                <div>
                  <span className="block text-[13px] font-medium text-bone">{agentName}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-phosphor" />
                    <span className="font-mono text-[9px] text-phosphor/80">LIVE</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/5"
                aria-label="Minimize chat"
              >
                <X size={14} className="text-bone-faint" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 scroll-brass" style={{ maxHeight: '60vh' }}>
              {chatHistory.length === 0 && !guardrailPending && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brass/5">
                    <Bot size={18} className="text-brass/40" />
                  </div>
                  <p className="text-center text-[12px] text-bone-faint/40">
                    Agent messages will appear here
                  </p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-gradient-to-br from-brass to-brass-dim text-[12.5px] leading-relaxed text-primary-foreground shadow-[0_2px_12px_rgba(204,154,78,0.2)]"
                        : "rounded-bl-sm border border-border/30 bg-panel-raised/80 backdrop-blur-sm"
                    }`}
                  >
                    {msg.role === "user" ? msg.message : <Markdown>{msg.message}</Markdown>}
                  </div>
                </div>
              ))}

              {/* Inline guardrail confirmation card */}
              {guardrailPending && (
                <div className="animate-rise overflow-hidden rounded-2xl border border-coral-signal/30 bg-obsidian/60 backdrop-blur-sm">
                  <div className="h-[3px] w-full bg-gradient-to-r from-coral-signal via-amber-signal to-coral-signal" />
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-coral-signal/10">
                        <TriangleAlert size={14} className="text-coral-signal" />
                      </span>
                      <span className="text-[13px] font-medium text-bone">Confirm booking</span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-bone-dim">
                      Ready to book <span className="font-medium text-bone">{guardrail!.title}</span> for{" "}
                      <span className="font-mono text-brass-bright">{guardrail!.cost}</span>. This will
                      spend money — please authorize.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onCancel}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/40 py-2.5 text-[12px] text-bone-dim transition-all hover:border-border/60 hover:text-bone"
                      >
                        <X size={13} /> Cancel
                      </button>
                      <button
                        onClick={onAuthorize}
                        className="btn-primary-glass flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-medium text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
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
                  className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12px] backdrop-blur-sm ${
                    statusBanner.kind === "success"
                      ? "border-phosphor/20 bg-phosphor/5"
                      : "border-coral-signal/20 bg-coral-signal/5"
                  }`}
                >
                  {statusBanner.kind === "success" ? (
                    <CircleCheck size={15} className="mt-0.5 shrink-0 text-phosphor" />
                  ) : (
                    <XCircle size={15} className="mt-0.5 shrink-0 text-coral-signal" />
                  )}
                  <div className="min-w-0 flex-1 leading-snug text-bone">
                    <Markdown>{statusBanner.message}</Markdown>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border/20 px-3.5 pb-3.5 pt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isWaitingForReply ? "Reply to agent..." : "Send a message..."}
                  className="flex-1 rounded-xl border border-border/25 bg-obsidian/50 px-3.5 py-2.5 text-[12.5px] text-bone placeholder:text-bone-faint/35 outline-none transition-all duration-300 focus:border-brass/25 focus:shadow-[0_0_20px_rgba(204,154,78,0.06)] backdrop-blur-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="flex items-center justify-center rounded-xl px-3.5 py-2.5 transition-all duration-200 hover:brightness-110 disabled:opacity-30"
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
          boxShadow: `0 0 24px ${agentAccent}60, 0 0 48px ${agentAccent}30`,
          border: "1.5px solid rgba(255,255,255,0.12)",
        }}
        aria-label={isOpen ? "Minimize chat" : "Open chat"}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/15 to-transparent" />
        <div className="relative z-10">
          {isOpen ? <X size={22} className="text-white" /> : <Bot size={22} className="text-white" />}
        </div>
        {!isOpen && needsAttention && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-phosphor opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-phosphor" />
          </span>
        )}
      </button>

      <style>{`
        @keyframes chatPopIn {
          0% { opacity: 0; transform: scale(0.92) translateY(-10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .floating-agent-btn:hover {
          transform: scale(1.08) !important;
          box-shadow: 0 0 35px ${agentAccent}80, 0 0 60px ${agentAccent}40 !important;
        }
      `}</style>
    </div>
  );
}
