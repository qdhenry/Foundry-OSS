"use client";

import { useMemo } from "react";
import { formatTokens, timeAgo } from "../activity/utils";

interface TraceListProps {
  executions: any[];
  selectedId: string | null;
  onRowClick: (id: string) => void;
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-status-warning-bg text-status-warning-fg",
  accepted: "bg-status-success-bg text-status-success-fg",
  revised: "bg-brand-blue-50 text-brand-blue-700 dark:bg-brand-blue-900 dark:text-brand-blue-300",
  rejected: "bg-status-error-bg text-status-error-fg",
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  pr_event: "PR Event",
  gate_trigger: "Gate",
  scheduled: "Scheduled",
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-border-default px-4 py-3">
      <div className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
      <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
      <div className="h-4 w-16 animate-pulse rounded bg-surface-raised" />
      <div className="h-4 w-20 animate-pulse rounded bg-surface-raised" />
    </div>
  );
}

export function TraceList({ executions, selectedId, onRowClick, loading }: TraceListProps) {
  const sorted = useMemo(
    () => [...executions].sort((a, b) => b._creationTime - a._creationTime),
    [executions],
  );

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-default">
        <div className="border-b border-border-default bg-surface-raised px-4 py-2">
          <span className="text-xs font-medium text-text-muted">Loading executions...</span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-default py-16">
        <p className="text-sm text-text-muted">No executions match your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-default">
      {/* Header */}
      <div className="grid grid-cols-[1fr_120px_80px_80px_80px_100px] gap-2 border-b border-border-default bg-surface-raised px-4 py-2">
        <span className="text-xs font-medium text-text-muted">Execution</span>
        <span className="text-xs font-medium text-text-muted">Skill</span>
        <span className="text-xs font-medium text-text-muted">Trigger</span>
        <span className="text-xs font-medium text-text-muted">Tokens</span>
        <span className="text-xs font-medium text-text-muted">Latency</span>
        <span className="text-xs font-medium text-text-muted">Status</span>
      </div>

      {/* Rows */}
      <div className="max-h-[600px] overflow-y-auto">
        {sorted.map((exec) => {
          const isSelected = exec._id === selectedId;
          return (
            <button
              type="button"
              key={exec._id}
              onClick={() => onRowClick(exec._id)}
              className={`grid w-full grid-cols-[1fr_120px_80px_80px_80px_100px] gap-2 border-b border-border-default px-4 py-3 text-left transition-colors hover:bg-interactive-ghost ${
                isSelected ? "bg-brand-blue-50 dark:bg-brand-blue-900/20" : ""
              }`}
            >
              {/* Title + time */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="truncate text-sm font-medium text-text-primary">
                  {exec.taskTitle ?? exec.requirementTitle ?? exec.taskType ?? "Execution"}
                </span>
                <span className="text-xs text-text-muted">{timeAgo(exec._creationTime)}</span>
              </div>

              {/* Skill */}
              <span className="truncate self-center text-sm text-text-secondary">
                {exec.skillName ?? "—"}
              </span>

              {/* Trigger */}
              <span className="self-center text-xs text-text-secondary">
                {TRIGGER_LABELS[exec.trigger] ?? exec.trigger}
              </span>

              {/* Tokens */}
              <span className="self-center text-sm tabular-nums text-text-secondary">
                {exec.tokensUsed ? formatTokens(exec.tokensUsed) : "—"}
              </span>

              {/* Latency */}
              <span className="self-center text-sm tabular-nums text-text-secondary">
                {exec.durationMs
                  ? exec.durationMs >= 1000
                    ? `${(exec.durationMs / 1000).toFixed(1)}s`
                    : `${exec.durationMs}ms`
                  : "—"}
              </span>

              {/* Review Status */}
              <div className="self-center">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[exec.reviewStatus] ?? ""}`}
                >
                  {exec.reviewStatus}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-border-default bg-surface-raised px-4 py-2">
        <span className="text-xs text-text-muted">
          {sorted.length} execution{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
