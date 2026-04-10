"use client";

import { useQuery } from "convex/react";

interface CodeEvidenceSectionProps {
  gateId: string;
  sprintId?: string;
  programId: string;
}

const CI_BADGE: Record<string, { label: string; classes: string }> = {
  passing: {
    label: "Passing",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  failing: {
    label: "Failing",
    classes: "bg-status-error-bg text-status-error-fg",
  },
  pending: {
    label: "Pending",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  none: {
    label: "No CI",
    classes: "bg-surface-elevated text-text-secondary",
  },
};

const DEPLOY_STATUS: Record<string, { label: string; dot: string }> = {
  success: { label: "Deployed", dot: "bg-status-success-fg" },
  in_progress: { label: "Deploying", dot: "bg-status-warning-fg" },
  pending: { label: "Pending", dot: "bg-status-warning-fg" },
  failure: { label: "Failed", dot: "bg-status-error-fg" },
  error: { label: "Error", dot: "bg-status-error-fg" },
  inactive: { label: "Not deployed", dot: "bg-slate-300" },
};

function progressColor(pct: number): string {
  if (pct >= 80) return "bg-status-success-fg";
  if (pct >= 50) return "bg-status-warning-fg";
  return "bg-status-error-fg";
}

function metricColor(value: number, thresholds: { good: number; warn: number }): string {
  if (value >= thresholds.good) return "text-status-success-fg";
  if (value >= thresholds.warn) return "text-status-warning-fg";
  return "text-status-error-fg";
}

export function CodeEvidenceSection({ gateId, sprintId, programId }: CodeEvidenceSectionProps) {
  const evidence = useQuery(
    "sourceControl/gates/codeEvidence:assembleCodeEvidence" as any,
    sprintId ? { sprintId, programId } : "skip",
  );

  // No sprint linked — can't show evidence
  if (!sprintId) {
    return null;
  }

  // Loading
  if (evidence === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <CodeIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Code Evidence</h2>
        </div>
        <div className="mt-4 flex items-center justify-center py-6">
          <p className="text-sm text-text-secondary">Loading code evidence...</p>
        </div>
      </div>
    );
  }

  // Empty state: no PRs and no deployments
  if (
    evidence.totalPRs === 0 &&
    evidence.deploymentStatus.every((d: { status: string }) => d.status === "inactive")
  ) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <CodeIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Code Evidence</h2>
        </div>
        <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
            <CodeIcon className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-sm text-text-secondary">
            No source control data available for this gate. Connect repositories to automatically
            track code evidence.
          </p>
        </div>
      </div>
    );
  }

  const ciBadge = CI_BADGE[evidence.ciBranchStatus] ?? CI_BADGE.none;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <CodeIcon className="h-5 w-5 text-accent-default" />
        <h2 className="text-lg font-semibold text-text-heading">Code Evidence</h2>
        {evidence.hasHighRiskRequirements && (
          <span className="rounded-full bg-status-error-bg px-2.5 py-0.5 text-xs font-medium text-status-error-fg">
            High Risk
          </span>
        )}
      </div>

      {/* PR Merge Progress */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">PR Merge Completion</span>
          <span className="text-text-secondary">
            {evidence.mergedPRs}/{evidence.totalPRs} merged ({evidence.prMergeCompletionPct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`h-2 rounded-full transition-all ${progressColor(evidence.prMergeCompletionPct)}`}
            style={{ width: `${evidence.prMergeCompletionPct}%` }}
          />
        </div>
        {evidence.openPRs > 0 && (
          <p className="mt-1 text-xs text-status-warning-fg">
            {evidence.openPRs} PR{evidence.openPRs !== 1 ? "s" : ""} still open
          </p>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* CI Status */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            CI Status
          </p>
          <div className="mt-1.5">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ciBadge.classes}`}
            >
              {ciBadge.label}
            </span>
          </div>
        </div>

        {/* Review Coverage */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Review Coverage
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${metricColor(evidence.reviewCoveragePct, { good: 80, warn: 50 })}`}
          >
            {evidence.reviewCoveragePct}%
          </p>
          <p className="text-xs text-text-secondary">
            {evidence.reviewedPRCount}/{evidence.totalPRs} PRs reviewed
          </p>
        </div>

        {/* Unresolved Comments */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Unresolved Comments
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              evidence.unresolvedReviewComments > 0
                ? "text-status-error-fg"
                : "text-status-success-fg"
            }`}
          >
            {evidence.unresolvedReviewComments}
          </p>
          <p className="text-xs text-text-secondary">
            {evidence.unresolvedReviewComments === 0 ? "All resolved" : "Needs attention"}
          </p>
        </div>

        {/* Force Pushes */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Force Pushes
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              evidence.forcePushCount > 0 ? "text-status-warning-fg" : "text-status-success-fg"
            }`}
          >
            {evidence.forcePushCount}
          </p>
          <p className="text-xs text-text-secondary">
            {evidence.forcePushCount === 0 ? "Clean history" : "In sprint window"}
          </p>
        </div>

        {/* Review Coverage Bar */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Review Coverage Progress
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className={`h-2 rounded-full transition-all ${progressColor(evidence.reviewCoveragePct)}`}
              style={{ width: `${evidence.reviewCoveragePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deployment Status */}
      {evidence.deploymentStatus.some((d: { status: string }) => d.status !== "inactive") && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-heading">Deployment Status</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {evidence.deploymentStatus.map(
              (dep: {
                environment: string;
                status: string;
                deployedAt: number | null;
                sha: string | null;
              }) => {
                const status = DEPLOY_STATUS[dep.status] ?? DEPLOY_STATUS.inactive;
                return (
                  <div
                    key={dep.environment}
                    className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-3 py-2"
                  >
                    <span className="text-sm font-medium capitalize text-text-primary">
                      {dep.environment}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                      <span className="text-xs text-text-secondary">{status.label}</span>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeIcon({ className }: { className?: string }) {
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
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}
