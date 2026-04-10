"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { TargetPlatform } from "./ReAnalyzeDialog";

interface AnalysisProgressPanelProps {
  programId: string;
  orgId: string;
  targetPlatform: TargetPlatform;
  onComplete?: () => void;
}

const ACTIVE_STATUSES = new Set(["queued", "extracting", "analyzing"]);

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AnalysisProgressPanel({
  programId,
  orgId,
  targetPlatform,
  onComplete,
}: AnalysisProgressPanelProps) {
  const progress = useQuery(api.documentAnalysis.getBatchProgress, {
    programId,
  });

  const activityLogs = useQuery(api.documentAnalysis.getActivityLogs, {
    programId,
  });

  const documents = useQuery(api.documents.listByProgram, {
    programId,
  });

  const queueBatchAnalysis = useAction(api.documentAnalysisActions.queueBatchAnalysis);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const hadActiveRef = useRef(false);

  const latestByDocument = useMemo(() => {
    const map = new Map<string, any>();
    if (!progress) return map;

    for (const item of progress) {
      map.set(item.documentId, item);
    }

    return map;
  }, [progress]);

  const trackedRows = useMemo(() => {
    if (!documents) return [];

    const rows = documents
      .map((document: any) => {
        const status = document.analysisStatus ?? "none";
        const latest = latestByDocument.get(document._id);
        return {
          documentId: document._id,
          documentName: document.fileName,
          status,
          analysisId: latest?.analysisId ?? null,
        };
      })
      .filter((row: any) => row.status !== "none");

    return rows;
  }, [documents, latestByDocument]);

  const activeRows = trackedRows.filter((row: any) => ACTIVE_STATUSES.has(row.status));
  const failedRows = trackedRows.filter((row: any) => row.status === "failed");
  const completeRows = trackedRows.filter((row: any) => String(row.status) === "complete");

  useEffect(() => {
    if (activeRows.length > 0) {
      hadActiveRef.current = true;
      return;
    }

    if (hadActiveRef.current && activeRows.length === 0 && onComplete) {
      onComplete();
      hadActiveRef.current = false;
    }
  }, [activeRows.length, onComplete]);

  const logsByAnalysisId = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!activityLogs) return map;

    for (const log of activityLogs) {
      const existing = map.get(log.analysisId) ?? [];
      existing.push(log);
      map.set(log.analysisId, existing);
    }

    return map;
  }, [activityLogs]);

  async function handleRetryFailed() {
    if (failedRows.length === 0 || retrying) return;

    setRetrying(true);
    try {
      await queueBatchAnalysis({
        orgId,
        programId,
        documentIds: failedRows.map((row: any) => row.documentId),
        targetPlatform,
      });
    } finally {
      setRetrying(false);
    }
  }

  if (trackedRows.length === 0) return null;

  const progressPercent = Math.round((completeRows.length / trackedRows.length) * 100);

  return (
    <section className="rounded-xl border border-border-default bg-surface-default p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-heading">Analysis Progress</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {completeRows.length} complete · {activeRows.length} in progress · {failedRows.length}{" "}
            failed
          </p>
        </div>
        {failedRows.length > 0 && (
          <button
            type="button"
            onClick={handleRetryFailed}
            disabled={retrying}
            className="rounded-lg border border-status-error-border bg-status-error-bg px-3 py-1.5 text-xs font-medium text-status-error-fg hover:bg-status-error-bg disabled:opacity-60"
          >
            {retrying ? "Retrying..." : `Retry Failed (${failedRows.length})`}
          </button>
        )}
      </div>

      {failedRows.length > 0 && (
        <div className="mb-4 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          {trackedRows.length - failedRows.length} analyzed, {failedRows.length} failed. Retry
          failed documents to continue.
        </div>
      )}

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-accent-default transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {trackedRows.map((row: any) => {
          const logs = row.analysisId ? (logsByAnalysisId.get(row.analysisId) ?? []) : [];
          const isExpanded = expandedIds.has(row.documentId);

          const badgeTone: Record<string, string> = {
            queued: "bg-surface-elevated text-text-secondary",
            extracting: "bg-status-warning-bg text-status-warning-fg",
            analyzing: "bg-status-info-bg text-status-info-fg",
            complete: "bg-status-success-bg text-status-success-fg",
            completed: "bg-status-success-bg text-status-success-fg",
            failed: "bg-status-error-bg text-status-error-fg",
          };

          return (
            <div
              key={row.documentId}
              className="rounded-lg border border-border-default bg-surface-raised px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-text-heading">{row.documentName}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeTone[row.status] ?? badgeTone.queued}`}
                >
                  {row.status}
                </span>
              </div>

              {logs.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.documentId)) next.delete(row.documentId);
                        else next.add(row.documentId);
                        return next;
                      })
                    }
                    className="text-xs text-text-secondary hover:text-text-heading"
                  >
                    {isExpanded ? "Hide activity" : "Show activity"}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1 border-l-2 border-border-default pl-3">
                      {logs.map((log) => (
                        <div
                          key={log._id}
                          className="flex items-start justify-between gap-2 text-xs"
                        >
                          <span
                            className={
                              log.level === "error" ? "text-status-error-fg" : "text-text-primary"
                            }
                          >
                            {log.message}
                          </span>
                          <span className="shrink-0 text-text-muted">
                            {formatTime(log._creationTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
