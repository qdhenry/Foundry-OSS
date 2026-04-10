"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

interface PreviousPRsSectionProps {
  taskId: string;
  /** ID of the currently active (hero) PR, excluded from the list */
  activePrId?: string;
}

const PR_STATE_BADGE: Record<string, { classes: string; label: string }> = {
  draft: {
    classes: "bg-surface-elevated text-text-secondary",
    label: "Draft",
  },
  open: {
    classes: "bg-status-info-bg text-status-info-fg",
    label: "Open",
  },
  merged: {
    classes: "bg-status-success-bg text-status-success-fg",
    label: "Merged",
  },
  closed: {
    classes: "bg-surface-elevated text-text-secondary",
    label: "Closed",
  },
};

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

interface PRRowProps {
  pr: any;
}

function PRRow({ pr }: PRRowProps) {
  const [expanded, setExpanded] = useState(false);
  const displayState = pr.isDraft ? "draft" : pr.state;
  const badge = PR_STATE_BADGE[displayState] ?? PR_STATE_BADGE.open;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-interactive-hover"
      >
        {expanded ? (
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        )}
        <span className="font-mono text-xs text-text-muted">#{pr.prNumber}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.classes}`}
        >
          {badge.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-text-primary">{pr.title}</span>
      </button>

      {expanded && (
        <div className="border-t border-border-default bg-surface-raised px-5 py-3">
          {/* Branch */}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="font-mono">{pr.sourceBranch}</span>
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="font-mono">{pr.targetBranch}</span>
          </div>

          {/* Stats */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <span>
              {pr.commitCount} commit{pr.commitCount !== 1 ? "s" : ""}
            </span>
            <span>
              {pr.filesChanged} file{pr.filesChanged !== 1 ? "s" : ""}
            </span>
            <span className="text-status-success-fg">+{pr.additions}</span>
            <span className="text-status-error-fg">-{pr.deletions}</span>
          </div>

          {/* External link */}
          {pr.providerUrl && (
            <a
              href={pr.providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-accent-default hover:text-accent-strong"
            >
              View on GitHub →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function PreviousPRsSection({ taskId, activePrId }: PreviousPRsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const allPRs = useQuery("sourceControl/tasks/prLifecycle:getStackedPRs" as any, { taskId });

  // Filter out the currently active PR
  const previousPRs = allPRs?.filter((pr: any) => pr._id !== activePrId) ?? [];

  // Don't render if no previous PRs (after data loads)
  if (allPRs !== undefined && previousPRs.length === 0) {
    return null;
  }

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
        <span className="text-sm font-semibold text-text-primary">Previous PRs</span>
        {allPRs !== undefined && (
          <span className="text-xs text-text-muted">{previousPRs.length}</span>
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-border-default">
          {/* Loading */}
          {allPRs === undefined && (
            <div className="space-y-2 px-5 py-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-surface-raised" />
              ))}
            </div>
          )}

          {/* List */}
          {allPRs !== undefined && (
            <div className="divide-y divide-border-default">
              {previousPRs.map((pr: any) => (
                <PRRow key={pr._id} pr={pr} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
