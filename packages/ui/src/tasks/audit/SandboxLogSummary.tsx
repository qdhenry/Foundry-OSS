"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { formatLogTimestamp, LOG_LEVEL_BADGE } from "./logConstants";
import { parseLogMessage } from "./parseLogMessage";

interface SandboxLogSummaryProps {
  taskId: string;
}

export function SandboxLogSummary({ taskId }: SandboxLogSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = useQuery("sandbox/logs:summaryByTask" as any, { taskId });

  if (summary === undefined) return null;
  if (summary.totalCount === 0) return null;

  const levelEntries = Object.entries(summary.levelCounts as Record<string, number>);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Sandbox Logs
        {levelEntries.map(([level, count]) => {
          const badge = LOG_LEVEL_BADGE[level] ?? LOG_LEVEL_BADGE.info;
          return (
            <span
              key={level}
              className={`rounded px-1.5 py-0.5 font-normal ${badge.bg} ${badge.text}`}
            >
              {Number(count)} {level}
            </span>
          );
        })}
      </button>

      {expanded && summary.recentLogs.length > 0 && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-border-default">
          <div className="divide-y divide-border-default">
            {summary.recentLogs.map((log: any, i: number) => {
              const badge = LOG_LEVEL_BADGE[log.level] ?? LOG_LEVEL_BADGE.info;
              const parsed = log.level === "stdout" ? parseLogMessage(log.message) : null;
              return (
                <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 text-[10px]">
                  <span className="shrink-0 font-mono text-text-muted">
                    {formatLogTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badge.bg} ${badge.text}`}
                  >
                    {log.level}
                  </span>
                  <span className="min-w-0 break-all text-sm text-text-primary">
                    {parsed ? parsed.summary : log.message}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
