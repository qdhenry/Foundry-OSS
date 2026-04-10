"use client";

import { Stars01 } from "@untitledui/icons";

type ReviewStatus = "pending" | "accepted" | "revised" | "rejected";

interface Execution {
  _id: string;
  _creationTime: number;
  taskType: string;
  skillName?: string | null;
  trigger: string;
  inputSummary?: string | null;
  outputSummary?: string | null;
  tokensUsed?: number | null;
  durationMs?: number | null;
  reviewStatus: ReviewStatus;
}

interface ActivityFeedProps {
  executions: Execution[];
  limit?: number;
  showPurpleAccent?: boolean;
  onSelect?: (executionId: string) => void;
}

const REVIEW_BADGE: Record<ReviewStatus, { label: string; classes: string }> = {
  pending: {
    label: "Pending",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  accepted: {
    label: "Accepted",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  revised: {
    label: "Revised",
    classes: "bg-status-info-bg text-accent-default",
  },
  rejected: {
    label: "Rejected",
    classes: "bg-status-error-bg text-status-error-fg",
  },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({
  executions,
  limit,
  showPurpleAccent = false,
  onSelect,
}: ActivityFeedProps) {
  const items = limit ? executions.slice(0, limit) : executions;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-default py-12">
        <Stars01 size={32} className="mb-3 text-emerald-400" />
        <p className="text-sm font-medium text-text-heading">No agent executions yet</p>
        <p className="mt-1 text-xs text-text-muted">Execute a skill to see activity here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((exec) => {
        const badge = REVIEW_BADGE[exec.reviewStatus];
        return (
          <div
            key={exec._id}
            onClick={() => onSelect?.(exec._id)}
            className={`rounded-lg border border-border-default bg-surface-default p-3 ${
              showPurpleAccent ? "border-l-4 border-l-emerald-500" : ""
            } ${onSelect ? "cursor-pointer transition-colors hover:bg-interactive-hover" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-heading">
                {exec.skillName ?? "Agent Task"}
              </p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
              >
                {badge.label}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
              <span>{exec.taskType}</span>
              <span>&middot;</span>
              <span>{timeAgo(exec._creationTime)}</span>
              {exec.tokensUsed != null && (
                <>
                  <span>&middot;</span>
                  <span>{exec.tokensUsed.toLocaleString()} tokens</span>
                </>
              )}
              {exec.durationMs != null && (
                <>
                  <span>&middot;</span>
                  <span>{(exec.durationMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
            {exec.inputSummary && (
              <p className="mt-1.5 line-clamp-1 text-xs text-text-secondary">{exec.inputSummary}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
