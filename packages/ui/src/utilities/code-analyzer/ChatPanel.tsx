"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

export interface ChatPanelProps {
  analysisId: string;
  orgId: string;
}

export function ChatPanel({ analysisId, orgId }: ChatPanelProps) {
  const { isAuthenticated } = useConvexAuth();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    "codebaseAnalysis:getChatMessages" as any,
    isAuthenticated && orgId ? { analysisId, orgId } : "skip",
  ) as any[] | undefined;

  const sendMessage = useMutation("codebaseAnalysis:sendChatMessage" as any);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);

    try {
      await sendMessage({ analysisId, orgId, content: text });
    } catch (_err) {
      // Restore input on error
      setInput(text);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isWaitingForAssistant =
    messages && messages.length > 0 && messages[messages.length - 1]?.role === "user";

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-border-default bg-surface-secondary">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages === undefined ? (
          <div className="flex h-full items-center justify-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <svg
              className="mb-3 h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              />
            </svg>
            <p className="text-sm text-text-secondary">Ask questions about the codebase.</p>
            <p className="mt-1 text-xs text-text-muted">
              The AI has full context from the analysis to answer your questions.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg: any, index: number) => (
              <div
                key={msg._id ?? index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent-default text-white"
                      : "bg-surface-default border border-border-default text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content ?? msg.message}</p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {(isSending || isWaitingForAssistant) && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-border-default bg-surface-default px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-default p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 rounded-lg bg-accent-default p-2 text-white transition-all duration-200 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
