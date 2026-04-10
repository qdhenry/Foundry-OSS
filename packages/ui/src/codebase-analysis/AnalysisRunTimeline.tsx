"use client";

import { CheckCircle, ChevronDown, ChevronRight, Clock, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { AnalysisRunDetail } from "./AnalysisRunDetail";

interface AnalysisRun {
  _id: string;
  status: string;
  scope: string;
  config: { modelTier: string; confidenceThreshold: number };
  totalRequirements: number;
  analyzedCount: number;
  summary?: {
    notFound: number;
    partiallyImplemented: number;
    fullyImplemented: number;
    needsVerification: number;
    autoApplied: number;
    pendingReview: number;
  };
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  tokenUsage?: { input: number; output: number; cost: number };
  _creationTime: number;
}

interface AnalysisRunTimelineProps {
  runs: AnalysisRun[];
  onSelectRun?: (runId: string) => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-text-muted" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-accent-default" />,
  completed: <CheckCircle className="h-4 w-4 text-status-success-fg" />,
  failed: <XCircle className="h-4 w-4 text-status-error-fg" />,
  cancelled: <XCircle className="h-4 w-4 text-text-muted" />,
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnalysisRunTimeline({ runs }: AnalysisRunTimelineProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-8 text-center">
        <p className="text-sm text-text-secondary">
          No analysis runs yet. Configure and run your first analysis above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const isExpanded = expandedRunId === run._id;
        const coveragePct =
          run.summary && run.totalRequirements > 0
            ? Math.round(
                ((run.summary.fullyImplemented + run.summary.partiallyImplemented) /
                  run.totalRequirements) *
                  100,
              )
            : null;

        return (
          <div key={run._id} className="rounded-lg border border-border-default bg-surface-default">
            <button
              onClick={() => setExpandedRunId(isExpanded ? null : run._id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
            >
              {STATUS_ICON[run.status] ?? STATUS_ICON.pending}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {run.scope.charAt(0).toUpperCase() + run.scope.slice(1)} Analysis
                  </span>
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-secondary">
                    {run.config.modelTier}
                  </span>
                  {run.status === "running" && (
                    <span className="text-xs text-accent-default">
                      {run.analyzedCount}/{run.totalRequirements}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">{formatDate(run._creationTime)}</span>
              </div>

              {/* Summary badges */}
              {run.summary && (
                <div className="flex items-center gap-2">
                  {coveragePct !== null && (
                    <span className="text-xs font-medium text-text-secondary">
                      {coveragePct}% coverage
                    </span>
                  )}
                  {run.summary.pendingReview > 0 && (
                    <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-fg">
                      {run.summary.pendingReview} pending
                    </span>
                  )}
                </div>
              )}

              {run.tokenUsage && (
                <span className="text-xs text-text-muted">${run.tokenUsage.cost.toFixed(2)}</span>
              )}

              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-text-muted" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-border-default px-4 py-3">
                <AnalysisRunDetail runId={run._id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
