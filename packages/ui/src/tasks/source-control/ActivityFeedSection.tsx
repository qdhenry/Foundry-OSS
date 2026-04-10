"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

interface ActivityFeedSectionProps {
  taskId: string;
}

type ActivityEventType =
  | "pr_created"
  | "pr_updated"
  | "pr_merged"
  | "pr_closed"
  | "pr_reopened"
  | "commits_pushed"
  | "ci_passed"
  | "ci_failed"
  | "ci_pending"
  | "review_submitted"
  | "review_requested"
  | "draft_promoted"
  | "description_updated"
  | "conflict_detected"
  | "conflict_resolved"
  | "task_status_changed";

const EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: string; dot: string; label: (meta: any) => string }
> = {
  pr_created: {
    icon: "🔀",
    dot: "bg-accent-default",
    label: (m) => `PR #${m?.prNumber ?? ""} created`,
  },
  pr_updated: {
    icon: "✏️",
    dot: "bg-text-muted",
    label: (m) => `PR #${m?.prNumber ?? ""} updated`,
  },
  pr_merged: {
    icon: "✅",
    dot: "bg-status-success-fg",
    label: (m) => `PR #${m?.prNumber ?? ""} merged`,
  },
  pr_closed: {
    icon: "🔴",
    dot: "bg-status-error-fg",
    label: (m) => `PR #${m?.prNumber ?? ""} closed`,
  },
  pr_reopened: {
    icon: "🔁",
    dot: "bg-status-warning-fg",
    label: (m) => `PR #${m?.prNumber ?? ""} reopened`,
  },
  commits_pushed: {
    icon: "📦",
    dot: "bg-text-muted",
    label: (m) => `${m?.commitCount ?? 1} commit${(m?.commitCount ?? 1) !== 1 ? "s" : ""} pushed`,
  },
  ci_passed: {
    icon: "✅",
    dot: "bg-status-success-fg",
    label: () => "CI checks passed",
  },
  ci_failed: {
    icon: "❌",
    dot: "bg-status-error-fg",
    label: () => "CI checks failed",
  },
  ci_pending: {
    icon: "⏳",
    dot: "bg-status-warning-fg",
    label: () => "CI checks running",
  },
  review_submitted: {
    icon: "👁️",
    dot: "bg-accent-default",
    label: (m) => `Review submitted by ${m?.reviewer ?? "reviewer"}`,
  },
  review_requested: {
    icon: "👤",
    dot: "bg-accent-default",
    label: (m) => `Review requested from ${m?.reviewer ?? "reviewer"}`,
  },
  draft_promoted: {
    icon: "🚀",
    dot: "bg-accent-default",
    label: () => "Draft promoted to ready for review",
  },
  description_updated: {
    icon: "📝",
    dot: "bg-text-muted",
    label: () => "PR description updated",
  },
  conflict_detected: {
    icon: "⚠️",
    dot: "bg-status-error-fg",
    label: () => "Merge conflicts detected",
  },
  conflict_resolved: {
    icon: "✅",
    dot: "bg-status-success-fg",
    label: () => "Merge conflicts resolved",
  },
  task_status_changed: {
    icon: "🔄",
    dot: "bg-text-muted",
    label: (m) => `Task status → ${m?.newStatus ?? "updated"}`,
  },
};

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ActivityFeedSection({ taskId }: ActivityFeedSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const events = useQuery("sourceControl/tasks/prLifecycle:getActivityFeed" as any, { taskId });

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        {collapsed ? (
          <ChevronRightIcon className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-text-muted" />
        )}
        <span className="text-sm font-semibold text-text-primary">Activity Feed</span>
        {events !== undefined && events.length > 0 && (
          <span className="text-xs text-text-muted">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-border-default">
          {/* Loading */}
          {events === undefined && (
            <div className="space-y-3 px-5 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-surface-elevated" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-surface-raised" />
                  <div className="h-3 w-12 animate-pulse rounded bg-surface-raised" />
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {events !== undefined && events.length === 0 && (
            <p className="px-5 py-4 text-xs text-text-muted">No activity yet</p>
          )}

          {/* Feed items */}
          {events !== undefined && events.length > 0 && (
            <div className="space-y-0 px-5 py-3">
              {events.map((event: any, idx: number) => {
                const type = event.eventType as ActivityEventType;
                const config = EVENT_CONFIG[type];
                const isLast = idx === events.length - 1;

                const label = config ? config.label(event.metadata) : event.eventType;

                const dotColor = config?.dot ?? "bg-text-muted";

                return (
                  <div key={event._id} className="relative flex gap-3 pb-3">
                    {/* Timeline line */}
                    {!isLast && (
                      <div className="absolute left-1 top-3.5 bottom-0 w-px bg-border-default" />
                    )}

                    {/* Dot */}
                    <div
                      className={`z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor} ring-2 ring-surface-default`}
                    />

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                      <p className="text-xs text-text-primary">
                        {label}
                        {event.actorLogin && (
                          <span className="ml-1 text-text-muted">by {event.actorLogin}</span>
                        )}
                      </p>
                      <span
                        className="shrink-0 text-[10px] text-text-muted"
                        title={new Date(event.occurredAt).toLocaleString()}
                      >
                        {formatRelativeTime(event.occurredAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
