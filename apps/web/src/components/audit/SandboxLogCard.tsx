"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatLogTimestamp, LOG_LEVEL_BADGE } from "./logConstants";
import { parseLogMessage } from "./parseLogMessage";
import { StructuredLogMessage } from "./StructuredLogMessage";

interface SandboxLogCardProps {
  taskId: Id<"tasks">;
}

export function SandboxLogCard({ taskId }: SandboxLogCardProps) {
  const logs = useQuery(api.sandbox.logs.listByTask, { taskId });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll when new logs arrive and user is at bottom
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setIsAtBottom(atBottom);
  }

  function jumpToLatest() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  }

  if (logs === undefined || logs.length === 0) return null;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Sandbox Logs</h2>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="relative">
        <div ref={scrollRef} onScroll={handleScroll} className="max-h-96 overflow-y-auto">
          <div className="divide-y divide-border-default">
            {logs.map((log: any) => {
              const badge = LOG_LEVEL_BADGE[log.level] ?? LOG_LEVEL_BADGE.info;
              const parsed = log.level === "stdout" ? parseLogMessage(log.message) : null;
              return (
                <div key={log._id} className="flex items-start gap-2 px-1 py-1.5">
                  <span className="shrink-0 font-mono text-xs text-text-muted">
                    {formatLogTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badge.bg} ${badge.text}`}
                  >
                    {log.level}
                  </span>
                  {parsed ? (
                    <StructuredLogMessage parsed={parsed} />
                  ) : (
                    <span className="min-w-0 break-all text-sm text-text-primary">
                      {log.message}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Jump to latest */}
        {!isAtBottom && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border-default bg-surface-default px-3 py-1 text-[10px] font-medium text-text-secondary shadow-sm transition-colors hover:bg-interactive-hover"
          >
            Jump to latest
          </button>
        )}
      </div>
    </div>
  );
}
