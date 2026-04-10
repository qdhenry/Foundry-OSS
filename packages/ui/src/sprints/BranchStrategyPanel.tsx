"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { GitHubInstallCTA, RepoPickerDropdown } from "../source-control";

interface BranchStrategyPanelProps {
  sprintId: string;
  programId: string;
  sprintPlanComplete: boolean;
  strategyData?: any;
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

const RISK_BADGE: Record<string, string> = {
  high: "bg-status-error-bg text-status-error-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-surface-elevated text-text-secondary",
};

export function BranchStrategyPanel({
  sprintId,
  programId,
  sprintPlanComplete,
  strategyData: strategyDataProp,
}: BranchStrategyPanelProps) {
  const strategyDataLocal = useQuery(
    "sourceControl/branching/strategyRecommendation:getStrategyForSprint" as any,
    strategyDataProp !== undefined ? "skip" : { sprintId: sprintId as any },
  );
  const strategyData = strategyDataProp ?? strategyDataLocal;
  const requestStrategy = useMutation(
    "sourceControl/branching/strategyRecommendation:requestStrategy" as any,
  );
  const repos = useQuery("sourceControl/repositories:listByProgram" as any, {
    programId: programId as any,
  });

  const [isRequesting, setIsRequesting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isRequesting && strategyData?.status === "processing") {
      setIsRequesting(false);
    }
  }, [strategyData?.status, isRequesting]);

  async function handleRequestStrategy() {
    setIsRequesting(true);
    try {
      await requestStrategy({ programId: programId as any, sprintId: sprintId as any });
    } catch {
      setIsRequesting(false);
    }
  }

  // Sequential gating: disabled until sprint has tasks
  if (!sprintPlanComplete) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5 opacity-60">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
        </div>
        <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
            <GitBranchIcon className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-secondary">Complete sprint planning first</p>
          <p className="mt-1 text-xs text-text-muted">
            Add at least one task to this sprint to generate a branch strategy.
          </p>
        </div>
      </div>
    );
  }

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

  const isProcessing = strategyData?.status === "processing" || isRequesting;
  const isError = strategyData?.status === "error";

  if (isProcessing) {
    const streamedBranches =
      (strategyData?.status === "processing"
        ? (strategyData as any)?.branchStrategy?.recommended_branches
        : undefined) ?? [];
    const progress =
      strategyData?.status === "processing"
        ? (strategyData as any)?.generationProgress
        : "Requesting branch strategy...";

    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5 text-accent-default" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-status-info-bg p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-default border-t-transparent" />
            <p className="text-sm font-medium text-text-heading">
              {progress ?? "Generating branch strategy..."}
            </p>
          </div>
        </div>

        {streamedBranches.length > 0 && (
          <div className="mt-4 space-y-2">
            {streamedBranches.map((branch: any, i: number) => (
              <BranchRow key={i} branch={branch} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isError) {
    if (repos !== undefined && repos.length === 0) {
      return (
        <div className="space-y-3">
          <GitHubInstallCTA purpose="plan sprint branches" />
          <RepoPickerDropdown programId={programId as string} entityType="workstream" />
        </div>
      );
    }

    const errorMsg = (strategyData as any)?.error ?? "";
    if (repos !== undefined && repos.length > 0 && /no connected repositor/i.test(errorMsg)) {
      return (
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <div className="flex items-center gap-2">
            <GitBranchIcon className="h-5 w-5 text-text-muted" />
            <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-text-secondary">
              Repositories are now connected. Generate a branch strategy.
            </p>
            <button
              onClick={handleRequestStrategy}
              disabled={isRequesting}
              className="btn-primary btn-sm mt-4 disabled:opacity-50"
            >
              {isRequesting ? "Generating..." : "Generate Strategy"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
        </div>
        <div className="mt-4 rounded-lg border border-status-error-border bg-status-error-bg p-4">
          <p className="text-sm font-medium text-status-error-fg">
            Branch strategy generation failed
          </p>
          <p className="mt-1 text-xs text-status-error-fg">
            {errorMsg || "An unexpected error occurred."}
          </p>
          <button
            onClick={handleRequestStrategy}
            disabled={isRequesting}
            className="mt-3 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isRequesting ? "Retrying..." : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  if (strategyData === null) {
    if (repos !== undefined && repos.length === 0) {
      return (
        <div className="space-y-3">
          <GitHubInstallCTA purpose="plan sprint branches" />
          <RepoPickerDropdown programId={programId as string} entityType="workstream" />
        </div>
      );
    }

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
            No branch strategy yet. Generate one based on the sprint&apos;s tasks and repository
            structure.
          </p>
          <button
            onClick={handleRequestStrategy}
            disabled={isRequesting}
            className="btn-primary btn-sm mt-4 disabled:opacity-50"
          >
            {isRequesting ? "Generating..." : "Generate Strategy"}
          </button>
        </div>
      </div>
    );
  }

  // --- Completed strategy view ---
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

  const branchCount = strategy.recommended_branches?.length ?? 0;
  const warningCount = strategy.overlap_warnings?.length ?? 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      {/* Summary Header — always visible */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-2 text-left"
        >
          <svg
            className={`h-4 w-4 text-text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <GitBranchIcon className="h-5 w-5 text-accent-default" />
          <h2 className="text-lg font-semibold text-text-heading">Branch Strategy</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${strategyBadge.classes}`}
          >
            {strategyBadge.label}
          </span>
        </button>
        <div className="flex items-center gap-3">
          {!isExpanded && (
            <span className="text-xs text-text-muted">
              {branchCount} branch{branchCount !== 1 ? "es" : ""}
              {warningCount > 0 &&
                ` \u00B7 ${warningCount} warning${warningCount !== 1 ? "s" : ""}`}
            </span>
          )}
          <button
            onClick={handleRequestStrategy}
            disabled={isRequesting}
            title="Regenerate branch strategy with AI"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-accent-default transition-colors hover:bg-interactive-hover disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRequesting ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>

      {/* Collapsible detail content */}
      {isExpanded && (
        <div className="mt-5">
          <p className="mb-5 text-sm text-text-secondary">{strategy.rationale}</p>

          {/* Branch Rows */}
          {strategy.recommended_branches?.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-3 text-sm font-semibold text-text-heading">
                Recommended Branches ({strategy.recommended_branches.length})
              </h3>
              <div className="space-y-2">
                {strategy.recommended_branches.map((branch, i) => (
                  <BranchRow key={i} branch={branch} />
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
                    className="rounded-lg border border-border-default bg-surface-raised p-3"
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
              <h3 className="mb-3 text-sm font-semibold text-text-heading">Merge Order</h3>
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
      )}
    </div>
  );
}

function BranchRow({ branch }: { branch: any }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-3">
      <div className="flex items-start justify-between gap-2">
        <code className="rounded bg-surface-elevated px-2 py-0.5 font-mono text-sm">
          {branch.branch_name}
        </code>
        {branch.parent_branch && (
          <span className="shrink-0 text-xs text-text-secondary">
            from{" "}
            <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono">
              {branch.parent_branch}
            </code>
          </span>
        )}
      </div>
      {branch.purpose && <p className="mt-1.5 text-sm text-text-secondary">{branch.purpose}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {branch.workstreams?.map((ws: string, j: number) => (
          <span
            key={j}
            className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-fg"
          >
            {ws}
          </span>
        ))}
        {branch.merge_timing && (
          <span className="text-xs text-text-secondary">Merge: {branch.merge_timing}</span>
        )}
      </div>
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
