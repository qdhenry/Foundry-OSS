"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface AnalysisStepProps {
  programId: string;
  onNext: () => void;
  onBack: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: "spinner" | "check" | "error" | "queue" }
> = {
  queued: {
    label: "Queued",
    color: "bg-surface-elevated text-text-secondary",
    icon: "queue",
  },
  uploading: {
    label: "Uploading",
    color: "bg-status-warning-bg text-status-warning-fg",
    icon: "spinner",
  },
  indexing: {
    label: "Indexing",
    color: "bg-status-warning-bg text-status-warning-fg",
    icon: "spinner",
  },
  extracting: {
    label: "Indexing",
    color: "bg-status-warning-bg text-status-warning-fg",
    icon: "spinner",
  },
  analyzing: {
    label: "Analyzing",
    color: "bg-status-info-bg text-accent-default",
    icon: "spinner",
  },
  transcribing: {
    label: "Indexing",
    color: "bg-status-warning-bg text-status-warning-fg",
    icon: "spinner",
  },
  classifying_frames: {
    label: "Indexing",
    color: "bg-status-warning-bg text-status-warning-fg",
    icon: "spinner",
  },
  awaiting_speakers: {
    label: "Analyzing",
    color: "bg-status-info-bg text-accent-default",
    icon: "spinner",
  },
  synthesizing: {
    label: "Analyzing",
    color: "bg-status-info-bg text-accent-default",
    icon: "spinner",
  },
  complete: {
    label: "Complete",
    color: "bg-status-success-bg text-status-success-fg",
    icon: "check",
  },
  failed: {
    label: "Failed",
    color: "bg-status-error-bg text-status-error-fg",
    icon: "error",
  },
};

const STEP_ICON: Record<string, "check" | "spinner" | "error"> = {
  queued: "check",
  uploading: "spinner",
  indexing: "spinner",
  extracting: "spinner",
  transcribing: "spinner",
  classifying_frames: "spinner",
  awaiting_speakers: "spinner",
  extracted: "check",
  synthesizing: "spinner",
  context: "spinner",
  calling_ai: "check",
  ai_responding: "check",
  ai_requirements: "check",
  ai_risks: "check",
  ai_integrations: "check",
  ai_decisions: "check",
  ai_summary: "check",
  parsing: "spinner",
  findings: "check",
  complete: "check",
  failed: "error",
};

const ACTIVE_STATUSES = new Set([
  "uploading",
  "indexing",
  "extracting",
  "transcribing",
  "classifying_frames",
  "awaiting_speakers",
  "analyzing",
  "synthesizing",
]);

function StatusIcon({ type }: { type: "spinner" | "check" | "error" | "queue" }) {
  if (type === "spinner") {
    return (
      <svg className="h-4 w-4 animate-spin text-current" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }
  if (type === "check") {
    return (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M12 3l9.66 16.59A1 1 0 0120.84 21H3.16a1 1 0 01-.82-1.41L12 3z"
        />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ActivityStepIcon({ type }: { type: "check" | "spinner" | "error" }) {
  if (type === "spinner") {
    return (
      <svg
        className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-accent-default"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg
        className="mt-0.5 h-3 w-3 shrink-0 text-status-error-fg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg
      className="mt-0.5 h-3 w-3 shrink-0 text-status-success-fg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface ActivityLog {
  _id: string;
  _creationTime: number;
  analysisId: string;
  step: string;
  message: string;
  detail?: string;
  level: "info" | "success" | "error";
}

interface BatchProgressItem {
  analysisId: string;
  documentId: string;
  documentName: string;
  status: string;
  error?: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DocumentActivityLog({
  logs,
  isExpanded,
  onToggle,
}: {
  logs: ActivityLog[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (logs.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
      >
        <svg
          className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {isExpanded ? "Hide" : "View"} activity log
      </button>
      {isExpanded && (
        <div className="ml-1.5 mt-1.5 space-y-1 border-l-2 border-border-default pl-3">
          {logs.map((log) => {
            const isLast = log === logs[logs.length - 1];
            const stepIcon =
              isLast && log.level !== "success" && log.level !== "error"
                ? "spinner"
                : (STEP_ICON[log.step] ?? "check");
            return (
              <div key={log._id} className="flex items-start justify-between gap-2 text-xs">
                <div className="flex items-start gap-1.5">
                  <ActivityStepIcon type={stepIcon} />
                  <span
                    className={
                      log.level === "error" ? "text-status-error-fg" : "text-text-secondary"
                    }
                  >
                    {log.message}
                  </span>
                </div>
                <span className="shrink-0 text-text-muted">{formatTime(log._creationTime)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AnalysisStep({ programId, onNext, onBack }: AnalysisStepProps) {
  const progress = useQuery(api.documentAnalysis.getBatchProgress, {
    programId: programId as Id<"programs">,
  }) as BatchProgressItem[] | undefined;

  const activityLogs = useQuery(api.documentAnalysis.getActivityLogs, {
    programId: programId as Id<"programs">,
  });

  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const toggleExpanded = (analysisId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(analysisId)) {
        next.delete(analysisId);
      } else {
        next.add(analysisId);
      }
      return next;
    });
  };

  // Group activity logs by analysisId
  const logsByAnalysis = new Map<string, ActivityLog[]>();
  if (activityLogs) {
    for (const log of activityLogs) {
      const existing = logsByAnalysis.get(log.analysisId) ?? [];
      existing.push(log as ActivityLog);
      logsByAnalysis.set(log.analysisId, existing);
    }
  }

  const isLoading = progress === undefined;
  const total = progress?.length ?? 0;
  const successCount =
    progress?.filter((p: BatchProgressItem) => p.status === "complete").length ?? 0;
  const failedCount = progress?.filter((p: BatchProgressItem) => p.status === "failed").length ?? 0;
  const settled = successCount + failedCount;
  const allSettled = total > 0 && settled === total;
  const allSucceeded = allSettled && failedCount === 0;
  const allFailed = allSettled && successCount === 0;
  const inProgressCount =
    progress?.filter((p: BatchProgressItem) => ACTIVE_STATUSES.has(p.status)).length ?? 0;

  // Auto-advance only when all documents succeeded (not when all failed)
  useEffect(() => {
    if (allSucceeded) {
      const timer = setTimeout(onNext, 1500);
      return () => clearTimeout(timer);
    }
  }, [allSucceeded, onNext]);

  const progressPercent = total > 0 ? Math.round((settled / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <h2 className="mb-1 text-lg font-semibold text-text-heading">AI Analysis</h2>
      <p className={`mb-6 text-sm ${allFailed ? "text-status-error-fg" : "text-text-secondary"}`}>
        {isLoading
          ? "Loading analysis status..."
          : total === 0
            ? "No documents to analyze."
            : allSucceeded
              ? "All documents analyzed! Moving to review..."
              : allFailed
                ? `All ${total} documents failed to analyze. Check activity logs for error details.`
                : allSettled && failedCount > 0
                  ? `Analysis complete — ${successCount} succeeded, ${failedCount} failed.`
                  : `Processing ${inProgressCount > 0 ? `${settled + inProgressCount} of ${total}` : `${settled} of ${total}`} documents...`}
      </p>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
            <span>{progressPercent}% complete</span>
            <span>
              {settled}/{total} documents
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-accent-default transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Document list */}
      {progress && progress.length > 0 && (
        <div className="space-y-2">
          {progress.map((item: BatchProgressItem) => {
            const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.queued;
            const docLogs = logsByAnalysis.get(item.analysisId) ?? [];
            const latestLog = docLogs.length > 0 ? docLogs[docLogs.length - 1] : null;
            const findingsLog = docLogs.find((l) => l.step === "findings");
            const isActive = ACTIVE_STATUSES.has(item.status);
            const isComplete = item.status === "complete";

            return (
              <div
                key={item.analysisId}
                className="rounded-lg border border-border-default bg-surface-raised px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <svg
                      className="h-4 w-4 shrink-0 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="truncate text-sm font-medium text-text-heading">
                      {item.documentName}
                    </span>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
                  >
                    <StatusIcon type={config.icon} />
                    {config.label}
                  </span>
                </div>

                {/* Current activity message for in-progress documents */}
                {isActive && latestLog && (
                  <p className="mt-1 ml-7 text-xs text-text-secondary animate-pulse">
                    {latestLog.message}
                  </p>
                )}

                {/* Findings summary for completed documents */}
                {isComplete && findingsLog && (
                  <p className="mt-1 ml-7 text-xs text-status-success-fg">{findingsLog.message}</p>
                )}

                {/* Error message for failed documents */}
                {item.status === "failed" && latestLog && latestLog.level === "error" && (
                  <p className="mt-1 ml-7 text-xs text-status-error-fg">{latestLog.message}</p>
                )}

                {/* Expandable activity timeline */}
                {docLogs.length > 0 && (
                  <div className="ml-7">
                    <DocumentActivityLog
                      logs={docLogs}
                      isExpanded={expandedDocs.has(item.analysisId)}
                      onToggle={() => toggleExpanded(item.analysisId)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {total === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-border-default p-8 text-center">
          <p className="text-sm text-text-secondary">
            No documents were uploaded. You can go back to upload documents or skip to review.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!allSettled && total > 0}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-50"
        >
          {allSucceeded
            ? "Continue to Review"
            : allSettled && failedCount > 0
              ? `Continue (${failedCount} failed)`
              : total === 0
                ? "Skip to Review"
                : "Waiting..."}
        </button>
      </div>
    </div>
  );
}
