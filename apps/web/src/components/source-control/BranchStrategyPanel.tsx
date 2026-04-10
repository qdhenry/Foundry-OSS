"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface BranchStrategyPanelProps {
  sprintId: Id<"sprints">;
  programId: Id<"programs">;
}

type StrategyType =
  | "feature_branches"
  | "workstream_branches"
  | "shared_integration"
  | "trunk_based";

const STRATEGY_LABELS: Record<StrategyType, { label: string; classes: string }> = {
  feature_branches: {
    label: "Feature Branches",
    classes: "bg-status-info-bg text-status-info-fg",
  },
  workstream_branches: {
    label: "Workstream Branches",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  shared_integration: {
    label: "Shared Integration",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  trunk_based: {
    label: "Trunk-Based",
    classes: "bg-surface-elevated text-text-primary",
  },
};

const RISK_STYLES: Record<string, string> = {
  high: "border-status-error-border bg-status-error-bg",
  medium: "border-status-warning-border bg-status-warning-bg",
  low: "border-border-default bg-surface-raised",
};

const RISK_BADGE: Record<string, string> = {
  high: "bg-status-error-bg text-status-error-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-surface-elevated text-text-secondary",
};

export function BranchStrategyPanel({ sprintId, programId }: BranchStrategyPanelProps) {
  const strategyData = useQuery(
    api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
    { sprintId },
  );
  const requestStrategy = useMutation(
    api.sourceControl.branching.strategyRecommendation.requestStrategy,
  );

  const [isRequesting, setIsRequesting] = useState(false);

  async function handleRequestStrategy() {
    setIsRequesting(true);
    try {
      await requestStrategy({ programId, sprintId });
    } finally {
      setIsRequesting(false);
    }
  }

  // Loading state
  if (strategyData === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
        </div>
        <div className="mt-4 flex items-center justify-center py-6">
          <p className="text-sm text-text-secondary">Loading strategy data...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (strategyData === null) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
        </div>
        <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
            <GitBranchIcon className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-sm text-text-secondary">
            No branch strategy recommendations available. Connect repositories and create sprint
            plans to receive AI-powered recommendations.
          </p>
          <button
            onClick={handleRequestStrategy}
            disabled={isRequesting}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isRequesting ? "Requesting..." : "Generate Strategy"}
          </button>
        </div>
      </div>
    );
  }

  const strategy = strategyData.branchStrategy as {
    strategy_type: StrategyType;
    rationale: string;
    recommended_branches: Array<{
      branch_name: string;
      purpose: string;
      parent_branch: string;
      workstreams: string[];
      tasks: string[];
      merge_timing: string;
    }>;
    overlap_warnings: Array<{
      file_or_module: string;
      workstreams: string[];
      conflict_risk: string;
      recommendation: string;
    }>;
    merge_order: Array<{
      branch: string;
      merge_into: string;
      order: number;
      rationale: string;
    }>;
  };

  const strategyBadge = STRATEGY_LABELS[strategy.strategy_type] ?? STRATEGY_LABELS.feature_branches;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5 text-accent-default" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${strategyBadge.classes}`}
          >
            {strategyBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRequestStrategy}
            disabled={isRequesting}
            className="rounded-lg px-3 py-1.5 text-sm text-accent-default transition-colors hover:bg-interactive-hover"
          >
            {isRequesting ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Rationale */}
      <p className="mb-5 text-sm text-text-secondary">{strategy.rationale}</p>

      {/* Recommended Branches */}
      {strategy.recommended_branches?.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-semibold text-text-heading">Recommended Branches</h3>
          <div className="space-y-2">
            {strategy.recommended_branches.map((branch, i) => (
              <div
                key={i}
                className="rounded-lg border border-border-default bg-surface-raised p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="rounded bg-surface-elevated px-2 py-0.5 font-mono text-sm">
                    {branch.branch_name}
                  </code>
                  <span className="shrink-0 text-xs text-text-secondary">
                    from{" "}
                    <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono">
                      {branch.parent_branch}
                    </code>
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-text-secondary">{branch.purpose}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {branch.workstreams?.map((ws, j) => (
                    <span
                      key={j}
                      className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-fg"
                    >
                      {ws}
                    </span>
                  ))}
                  {branch.merge_timing && (
                    <span className="text-xs text-text-secondary">
                      Merge: {branch.merge_timing}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlap Warnings */}
      {strategy.overlap_warnings?.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-semibold text-text-heading">Overlap Warnings</h3>
          <div className="space-y-2">
            {strategy.overlap_warnings.map((warning, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${RISK_STYLES[warning.conflict_risk] ?? RISK_STYLES.low}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="rounded bg-surface-elevated px-2 py-0.5 font-mono text-sm">
                    {warning.file_or_module}
                  </code>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BADGE[warning.conflict_risk] ?? RISK_BADGE.low}`}
                  >
                    {warning.conflict_risk} risk
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {warning.workstreams?.map((ws, j) => (
                    <span
                      key={j}
                      className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-fg"
                    >
                      {ws}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-text-secondary">{warning.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merge Order */}
      {strategy.merge_order?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-heading">Recommended Merge Order</h3>
          <ol className="space-y-2">
            {strategy.merge_order
              .sort((a, b) => a.order - b.order)
              .map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-raised p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-warning-bg text-xs font-bold text-status-warning-fg">
                    {step.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <code className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs">
                        {step.branch}
                      </code>
                      <svg
                        className="h-3.5 w-3.5 text-text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                      <code className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs">
                        {step.merge_into}
                      </code>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{step.rationale}</p>
                  </div>
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3v12m0 0a3 3 0 103 3H15a3 3 0 100-3H9a3 3 0 01-3-3zm0-6a3 3 0 100-6 3 3 0 000 6z"
      />
    </svg>
  );
}
