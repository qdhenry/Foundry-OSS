"use client";

import { useGSAP } from "@gsap/react";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSandboxBackend } from "../backend";
import { gsap } from "../theme/gsap";

interface ChatMessage {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "sent" | "streaming" | "complete" | "error";
  error?: string;
  createdAt: number;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function ChatPanel({ sessionId }: { sessionId: string }) {
  const { sendChatMessage } = useSandboxBackend();

  const session = useQuery(
    "sandbox/sessions:get" as any,
    sessionId ? { sessionId: sessionId as any } : "skip",
  ) as any;

  const messages = useQuery(
    "sandbox/sessions:getChatMessages" as any,
    sessionId ? { sessionId: sessionId as any } : "skip",
  ) as ChatMessage[] | undefined;

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCount = useRef(0);

  const isTerminal = session ? TERMINAL_STATUSES.has(session.status) : false;

  // Check if Claude is currently responding (last message is assistant + streaming)
  const isWaitingForResponse =
    messages &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].status === "streaming";

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages?.length, scrollToBottom]);

  // Auto-resize textarea up to 4 lines
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 4 + 16; // 4 lines + padding
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [input]);

  // Animate new messages sliding in
  useGSAP(
    () => {
      if (!messagesContainerRef.current) return;
      const allMessages = messagesContainerRef.current.querySelectorAll(".chat-message");
      const newMessages = Array.from(allMessages).slice(prevMessageCount.current);
      if (newMessages.length > 0) {
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          gsap.from(newMessages, {
            opacity: 0,
            y: 12,
            duration: 0.18,
            ease: "expo.out",
            clearProps: "all",
          });
        });
      }
      prevMessageCount.current = allMessages.length;
    },
    { scope: messagesContainerRef, dependencies: [messages?.length] },
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Allow sending even while waiting (interrupt support)
    if (isSending) return;
    // Block if session is in a terminal state
    if (isTerminal) return;

    setIsSending(true);
    setInput("");
    try {
      await sendChatMessage({
        sessionId,
        content: trimmed,
        role: "user",
      });
    } catch {
      // Message send failed - user can retry
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [input, isSending, isTerminal, sendChatMessage, sessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = input.trim().length > 0 && !isSending && !isTerminal;

  return (
    <div className="flex h-full flex-col bg-surface-default">
      {/* Header with claude session ID */}
      {session?.claudeSessionId ? (
        <div className="shrink-0 border-b border-border-subtle px-3 py-1.5">
          <span className="font-mono text-[10px] text-text-muted">
            Claude Session: {session.claudeSessionId}
          </span>
        </div>
      ) : null}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages === undefined ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-text-muted">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            <span className="text-xs">Send a message to interact with Claude</span>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.role === "system") {
                return (
                  <div key={msg._id} className="chat-message flex justify-center">
                    <div className="rounded-full bg-surface-raised px-3 py-1 text-[11px] text-text-secondary">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg._id}
                  className={`chat-message flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-interactive-subtle text-text-primary"
                        : "border border-border-default bg-surface-raised text-text-primary"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    {msg.status === "error" && msg.error ? (
                      <div className="mt-1 text-xs text-status-error-fg">{msg.error}</div>
                    ) : null}
                    {msg.status === "streaming" ? (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-default" />
                        <span className="text-[10px] text-text-muted">Generating...</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Thinking indicator */}
      {isWaitingForResponse ? (
        <div className="shrink-0 border-t border-border-subtle px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <span
                className="h-1 w-1 animate-bounce rounded-full bg-accent-default"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-1 w-1 animate-bounce rounded-full bg-accent-default"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1 w-1 animate-bounce rounded-full bg-accent-default"
                style={{ animationDelay: "300ms" }}
              />
            </span>
            <span>Claude is thinking...</span>
          </div>
        </div>
      ) : null}

      {/* Input area */}
      <div className="shrink-0 border-t border-border-default p-2">
        {isTerminal ? (
          <div className="rounded-lg bg-surface-raised px-3 py-2 text-center text-xs text-text-muted">
            Session has ended. No more messages can be sent.
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isWaitingForResponse ? "Type to interrupt..." : "Message Claude..."}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
              style={{ maxHeight: "96px" }}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="rounded-lg bg-accent-default p-2 text-text-on-brand transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              title="Send message"
            >
              {isSending ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
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
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
