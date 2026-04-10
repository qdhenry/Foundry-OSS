"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect } from "react";
import { api } from "../../../convex/_generated/api";

interface AnalysisSidePanelProps {
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type FindingType = "requirement" | "risk" | "integration" | "decision" | "action_item";
type FindingStatus = "pending" | "approved" | "rejected" | "imported" | "edited";
type Confidence = "high" | "medium" | "low";

const TYPE_BADGE: Record<FindingType, { label: string; classes: string }> = {
  requirement: {
    label: "Requirement",
    classes: "bg-status-info-bg text-accent-default",
  },
  risk: {
    label: "Risk",
    classes: "bg-status-error-bg text-status-error-fg",
  },
  integration: {
    label: "Integration",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  decision: {
    label: "Decision",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  action_item: {
    label: "Action Item",
    classes: "bg-status-success-bg text-status-success-fg",
  },
};

const CONFIDENCE_BADGE: Record<Confidence, string> = {
  high: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-error-bg text-status-error-fg",
};

const STATUS_BADGE: Record<FindingStatus, { label: string; classes: string }> = {
  pending: { label: "Pending", classes: "bg-surface-elevated text-text-secondary" },
  approved: { label: "Approved", classes: "bg-status-success-bg text-status-success-fg" },
  rejected: { label: "Rejected", classes: "bg-status-error-bg text-status-error-fg" },
  imported: { label: "Imported", classes: "bg-status-warning-bg text-status-warning-fg" },
  edited: { label: "Edited", classes: "bg-status-info-bg text-accent-default" },
};

const ANALYSIS_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  queued: { label: "Queued", classes: "bg-surface-elevated text-text-secondary" },
  extracting: { label: "Extracting", classes: "bg-status-warning-bg text-status-warning-fg" },
  analyzing: { label: "Analyzing", classes: "bg-status-warning-bg text-status-warning-fg" },
  complete: { label: "Complete", classes: "bg-status-success-bg text-status-success-fg" },
  completed: { label: "Complete", classes: "bg-status-success-bg text-status-success-fg" },
  failed: { label: "Failed", classes: "bg-status-error-bg text-status-error-fg" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1)}K`;
}

function formatTimestampLabel(
  sourceTimestamp?: number,
  sourceTimestampEnd?: number,
): string | null {
  if (typeof sourceTimestamp !== "number") return null;
  const format = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0)
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  if (typeof sourceTimestampEnd === "number" && sourceTimestampEnd >= sourceTimestamp) {
    return `${format(sourceTimestamp)}-${format(sourceTimestampEnd)}`;
  }
  return format(sourceTimestamp);
}

export function AnalysisSidePanel({ documentId, isOpen, onClose }: AnalysisSidePanelProps) {
  const analysis = useQuery(
    api.documentAnalysis.getByDocument,
    documentId ? { documentId: documentId as any } : "skip",
  );

  const findings = useQuery(
    api.discoveryFindings.listByDocument,
    documentId ? { documentId: documentId as any } : "skip",
  );

  // Keyboard dismiss
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Group findings by type
  const groupedFindings: Record<FindingType, typeof findings> = {
    requirement: [],
    risk: [],
    integration: [],
    decision: [],
    action_item: [],
  };
  if (findings) {
    for (const f of findings) {
      const type = f.type as FindingType;
      if (groupedFindings[type]) {
        groupedFindings[type]?.push(f);
      }
    }
  }

  const analysisStatusConfig = analysis
    ? (ANALYSIS_STATUS_CONFIG[analysis.status] ?? ANALYSIS_STATUS_CONFIG.queued)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full overflow-y-auto border-l border-border-default bg-surface-default shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Document analysis details"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-surface-default px-6 py-4">
          <h3 className="text-lg font-semibold text-text-heading">Analysis Details</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
            aria-label="Close panel"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          {/* Loading state */}
          {analysis === undefined && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
              ))}
            </div>
          )}

          {/* No analysis found */}
          {analysis === null && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">No analysis available for this document</p>
            </div>
          )}

          {/* Analysis summary */}
          {analysis && (
            <>
              <div className="mb-6 rounded-xl border border-border-default bg-surface-raised p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Status</span>
                  {analysisStatusConfig && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${analysisStatusConfig.classes}`}
                    >
                      {analysisStatusConfig.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {analysis.inputTokens != null && (
                    <div>
                      <span className="block text-xs text-text-muted">Input Tokens</span>
                      <span className="text-sm font-medium text-text-primary">
                        {formatTokens(analysis.inputTokens)}
                      </span>
                    </div>
                  )}
                  {analysis.outputTokens != null && (
                    <div>
                      <span className="block text-xs text-text-muted">Output Tokens</span>
                      <span className="text-sm font-medium text-text-primary">
                        {formatTokens(analysis.outputTokens)}
                      </span>
                    </div>
                  )}
                  {analysis.durationMs != null && (
                    <div>
                      <span className="block text-xs text-text-muted">Duration</span>
                      <span className="text-sm font-medium text-text-primary">
                        {formatDuration(analysis.durationMs)}
                      </span>
                    </div>
                  )}
                  {analysis.claudeModelId && (
                    <div>
                      <span className="block text-xs text-text-muted">Model</span>
                      <span className="text-sm font-medium text-text-primary">
                        {analysis.claudeModelId}
                      </span>
                    </div>
                  )}
                </div>
                {analysis.error && (
                  <div className="mt-3 rounded-lg bg-status-error-bg px-3 py-2">
                    <p className="text-xs text-status-error-fg">{analysis.error}</p>
                  </div>
                )}
              </div>

              {/* Findings grouped by type */}
              {findings === undefined ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-elevated" />
                  ))}
                </div>
              ) : findings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-text-secondary">No findings extracted</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {(Object.entries(groupedFindings) as [FindingType, typeof findings][]).map(
                    ([type, items]) => {
                      if (!items || items.length === 0) return null;
                      const typeBadge = TYPE_BADGE[type];
                      return (
                        <div key={type}>
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge.classes}`}
                            >
                              {typeBadge.label}
                            </span>
                            <span className="text-xs text-text-muted">{items.length}</span>
                          </div>
                          <div className="space-y-2">
                            {items.map((item: any) => {
                              const data = (item.editedData ?? item.data) as Record<
                                string,
                                unknown
                              >;
                              const sourceAttribution = (item.sourceAttribution ?? {}) as Record<
                                string,
                                unknown
                              >;
                              const sourceSpeaker =
                                sourceAttribution.sourceSpeaker &&
                                typeof sourceAttribution.sourceSpeaker === "object" &&
                                sourceAttribution.sourceSpeaker !== null
                                  ? (sourceAttribution.sourceSpeaker as Record<string, unknown>)
                                  : null;
                              const sourceTimestampLabel = formatTimestampLabel(
                                typeof sourceAttribution.sourceTimestamp === "number"
                                  ? sourceAttribution.sourceTimestamp
                                  : undefined,
                                typeof sourceAttribution.sourceTimestampEnd === "number"
                                  ? sourceAttribution.sourceTimestampEnd
                                  : undefined,
                              );
                              const speakerLabel =
                                (typeof sourceSpeaker?.name === "string" && sourceSpeaker.name) ||
                                (typeof sourceSpeaker?.speakerId === "string"
                                  ? sourceSpeaker.speakerId
                                  : null);
                              const keyframeUrl =
                                Array.isArray(sourceAttribution.sourceKeyframeUrls) &&
                                typeof sourceAttribution.sourceKeyframeUrls[0] === "string"
                                  ? sourceAttribution.sourceKeyframeUrls[0]
                                  : null;
                              const title =
                                typeof data.title === "string"
                                  ? data.title
                                  : typeof data.name === "string"
                                    ? data.name
                                    : "Untitled";
                              const confidence = item.confidence as Confidence;
                              const status = item.status as FindingStatus;
                              const statusBadge = STATUS_BADGE[status];
                              return (
                                <div
                                  key={item._id}
                                  className="rounded-lg border border-border-default px-3 py-2.5"
                                >
                                  <div className="mb-1 flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-text-heading line-clamp-1">
                                      {title}
                                    </p>
                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge.classes}`}
                                    >
                                      {statusBadge.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_BADGE[confidence]}`}
                                    >
                                      {confidence}
                                    </span>
                                  </div>
                                  {(sourceTimestampLabel || speakerLabel || keyframeUrl) && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                                      {sourceTimestampLabel && (
                                        <span className="rounded-full bg-surface-elevated px-2 py-0.5">
                                          {sourceTimestampLabel}
                                        </span>
                                      )}
                                      {speakerLabel && (
                                        <span className="rounded-full bg-surface-elevated px-2 py-0.5">
                                          {speakerLabel}
                                        </span>
                                      )}
                                      {keyframeUrl && (
                                        <a
                                          href={keyframeUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-full bg-surface-elevated px-2 py-0.5 hover:bg-interactive-hover"
                                        >
                                          Keyframe
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
