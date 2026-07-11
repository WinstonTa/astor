import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, X, Paperclip, Link, Code, Mic } from "lucide-react";

interface FloatingAgentChatProps {
  chatHistory: Array<{ role: "user" | "agent"; message: string }>;
  isWaitingForReply: boolean;
  onSendReply: (message: string) => void;
  agentName: string;
  agentAccent: string;
}

export function FloatingAgentChat({
  chatHistory,
  isWaitingForReply,
  onSendReply,
  agentName,
  agentAccent,
}: FloatingAgentChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isOpen]);

  // Auto-open when agent is waiting for reply
  useEffect(() => {
    if (isWaitingForReply && !isOpen) {
      setIsOpen(true);
    }
  }, [isWaitingForReply]);

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

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest(".floating-agent-btn")) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* Floating Button */}
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
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />
        <div className="relative z-10">
          {isOpen ? (
            <X size={22} className="text-white" />
          ) : (
            <Bot size={22} className="text-white" />
          )}
        </div>
        {!isOpen && isWaitingForReply && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-phosphor)] opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--color-phosphor)]" />
          </span>
        )}
        {!isOpen && (
          <div className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ backgroundColor: agentAccent }} />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          ref={chatRef}
          className="absolute bottom-16 left-0 w-[380px] max-w-[90vw]"
          style={{ animation: "chatPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" }}
        >
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-zinc-800/90 to-zinc-900/95 shadow-2xl backdrop-blur-3xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
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
              >
                <X size={14} className="text-bone-faint" />
              </button>
            </div>

            {/* Messages */}
            <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2.5 scroll-brass">
              {chatHistory.length === 0 && (
                <p className="text-center text-[12px] text-bone-faint/50 py-6">
                  Agent messages will appear here
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-brass to-brass-dim text-primary-foreground shadow-[0_2px_8px_rgba(204,154,78,0.15)]"
                        : "border border-border/30 bg-panel-raised text-bone"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/5 px-3 pb-3 pt-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isWaitingForReply ? "Reply to agent..." : "Send a message..."}
                    className="w-full rounded-xl border border-border/30 bg-obsidian/60 px-3.5 py-2.5 text-[12.5px] text-bone placeholder:text-bone-faint/40 outline-none transition-all duration-200 focus:border-brass/25 focus:shadow-[0_0_16px_rgba(204,154,78,0.06)]"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="flex items-center justify-center rounded-xl px-3 py-2.5 transition-all duration-200 hover:opacity-90 disabled:opacity-30"
                  style={{
                    background: `linear-gradient(135deg, ${agentAccent}, ${agentAccent}cc)`,
                  }}
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-bone-faint/40">
                <div className="flex items-center gap-3">
                  <button className="transition-colors hover:text-bone-faint"><Paperclip size={12} /></button>
                  <button className="transition-colors hover:text-bone-faint"><Link size={12} /></button>
                  <button className="transition-colors hover:text-bone-faint"><Code size={12} /></button>
                  <button className="transition-colors hover:text-bone-faint"><Mic size={12} /></button>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-green-500" />
                  <span>All systems operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatPopIn {
          0% { opacity: 0; transform: scale(0.85) translateY(16px); }
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
