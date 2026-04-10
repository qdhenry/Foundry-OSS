"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface AnalysisProgressProps {
  programId: string;
}

type AnalysisStatus = "queued" | "extracting" | "analyzing" | "complete" | "failed";

const STATUS_CONFIG: Record<AnalysisStatus, { label: string; classes: string; dot: string }> = {
  queued: {
    label: "Queued",
    classes: "bg-surface-elevated text-text-secondary",
    dot: "bg-slate-400",
  },
  extracting: {
    label: "Extracting",
    classes: "bg-status-warning-bg text-status-warning-fg",
    dot: "bg-yellow-500",
  },
  analyzing: {
    label: "Analyzing",
    classes: "bg-status-warning-bg text-status-warning-fg",
    dot: "bg-amber-500 animate-pulse",
  },
  complete: {
    label: "Complete",
    classes: "bg-status-success-bg text-status-success-fg",
    dot: "bg-green-500",
  },
  failed: {
    label: "Failed",
    classes: "bg-status-error-bg text-status-error-fg",
    dot: "bg-red-500",
  },
};

export function AnalysisProgress({ programId }: AnalysisProgressProps) {
  const progress = useQuery(api.documentAnalysis.getBatchProgress, {
    programId,
  });

  if (progress === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-surface-raised" />
        <div className="mb-3 h-2 w-full animate-pulse rounded-full bg-surface-raised" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-raised" />
          ))}
        </div>
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default px-6 py-12 text-center">
        <p className="text-sm text-text-secondary">No documents are being analyzed</p>
      </div>
    );
  }

  const completeCount = progress.filter((d: { status: string }) => d.status === "complete").length;
  const totalCount = progress.length;
  const progressPercent = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-heading">Analysis Progress</h3>
        <span className="text-sm text-text-secondary">
          {completeCount} of {totalCount} documents analyzed
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressPercent === 100 ? "bg-green-500" : "bg-accent-default"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Per-document status list */}
      <div className="space-y-2">
        {progress.map((doc: { analysisId: string; documentName: string; status: string }) => {
          const config = STATUS_CONFIG[doc.status as AnalysisStatus] ?? STATUS_CONFIG.queued;
          return (
            <div
              key={doc.analysisId}
              className="flex items-center justify-between rounded-lg border border-border-default px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                <span className="truncate text-sm text-text-primary">{doc.documentName}</span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
