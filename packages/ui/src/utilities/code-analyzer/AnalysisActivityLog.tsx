"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

const LEVEL_STYLES: Record<string, string> = {
  info: "text-text-secondary",
  success: "text-status-success-fg",
  error: "text-status-error-fg",
};

const LEVEL_DOT: Record<string, string> = {
  info: "bg-text-muted",
  success: "bg-status-success-fg",
  error: "bg-status-error-fg",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export interface AnalysisActivityLogProps {
  analysisId: string;
  orgId: string;
}

export function AnalysisActivityLog({ analysisId, orgId }: AnalysisActivityLogProps) {
  const { isAuthenticated } = useConvexAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = useQuery(
    "codebaseAnalysis:getAnalysisLogs" as any,
    isAuthenticated && orgId ? { analysisId, orgId } : "skip",
  ) as
    | Array<{
        step: string;
        message: string;
        level: string;
        timestamp: number;
      }>
    | undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [logs?.length]);

  if (!logs || logs.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-border-default bg-surface-default px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent-default" />
          Waiting for activity...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-border-default bg-surface-default"
    >
      <div className="divide-y divide-border-subtle">
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-xs">
            <span className="shrink-0 font-mono text-text-muted">{formatTime(log.timestamp)}</span>
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_DOT[log.level] ?? LEVEL_DOT.info}`}
            />
            <span
              className={`${LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info} ${log.level === "success" ? "font-medium" : ""}`}
            >
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
