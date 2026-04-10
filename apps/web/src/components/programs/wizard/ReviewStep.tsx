"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

interface ReviewStepProps {
  programId: string;
  onNext: () => void;
  onBack: () => void;
}

type DiscoveryFinding = Doc<"discoveryFindings">;

type FindingType = "requirement" | "risk" | "integration" | "decision" | "action_item";

const TABS: { type: FindingType; label: string }[] = [
  { type: "requirement", label: "Requirements" },
  { type: "risk", label: "Risks" },
  { type: "integration", label: "Integrations" },
  { type: "decision", label: "Decisions" },
  { type: "action_item", label: "Action Items" },
];

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-error-bg text-status-error-fg",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-surface-elevated text-text-secondary",
  approved: "bg-status-success-bg text-status-success-fg",
  rejected: "bg-status-error-bg text-status-error-fg",
  edited: "bg-status-info-bg text-accent-default",
};

const BATCH_SIZE = 100;

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

export function ReviewStep({ programId, onNext, onBack }: ReviewStepProps) {
  const [activeTab, setActiveTab] = useState<FindingType>("requirement");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showPendingWarning, setShowPendingWarning] = useState(false);

  const findings = useQuery(api.discoveryFindings.listByProgram, {
    programId: programId as Id<"programs">,
  }) as DiscoveryFinding[] | undefined;

  const reviewFinding = useMutation(api.discoveryFindings.reviewFinding);
  const bulkReview = useMutation(api.discoveryFindings.bulkReviewFindings);

  const isLoading = findings === undefined;

  // Group findings by type
  const grouped = useMemo(() => {
    if (!findings) return {} as Record<FindingType, typeof findings>;
    const result: Record<FindingType, typeof findings> = {
      requirement: [],
      risk: [],
      integration: [],
      decision: [],
      action_item: [],
    };
    for (const f of findings) {
      result[f.type as FindingType]?.push(f);
    }
    return result;
  }, [findings]);

  // Stats
  const totalFindings = findings?.length ?? 0;
  const approvedCount =
    findings?.filter((f) => f.status === "approved" || f.status === "edited").length ?? 0;
  const rejectedCount = findings?.filter((f) => f.status === "rejected").length ?? 0;
  const pendingCount = findings?.filter((f) => f.status === "pending").length ?? 0;

  const currentItems = grouped[activeTab] ?? [];
  const pendingIds = currentItems.filter((f) => f.status === "pending").map((f) => f._id);

  const handleReview = async (
    findingId: Id<"discoveryFindings">,
    status: "approved" | "rejected",
  ) => {
    await reviewFinding({ findingId, status });
  };

  const handleBulkApprove = async () => {
    if (pendingIds.length === 0) return;
    await batchBulkReview(pendingIds, "approved");
  };

  const handleBulkReject = async () => {
    if (pendingIds.length === 0) return;
    await batchBulkReview(pendingIds, "rejected");
  };

  async function batchBulkReview(ids: Id<"discoveryFindings">[], status: "approved" | "rejected") {
    setBulkLoading(true);
    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        await bulkReview({ findingIds: ids.slice(i, i + BATCH_SIZE), status });
      }
    } finally {
      setBulkLoading(false);
    }
  }

  const allPendingIds = (findings ?? []).filter((f) => f.status === "pending").map((f) => f._id);
  const activeTabLabel = TABS.find((t) => t.type === activeTab)?.label ?? "";

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <h2 className="mb-1 text-lg font-semibold text-text-heading">Review Findings</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Review AI-extracted findings before importing them into your program.
      </p>

      {/* Summary stats */}
      {!isLoading && totalFindings > 0 && (
        <div className="mb-4 rounded-lg bg-surface-raised px-4 py-3">
          <p className="text-sm text-text-primary">
            <span className="font-semibold">{totalFindings}</span> findings extracted
            {approvedCount > 0 && (
              <>
                {" "}
                &mdash;{" "}
                <span className="font-medium text-status-success-fg">{approvedCount} approved</span>
              </>
            )}
            {rejectedCount > 0 && (
              <>
                , <span className="font-medium text-status-error-fg">{rejectedCount} rejected</span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                , <span className="font-medium text-text-secondary">{pendingCount} pending</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Global bulk actions */}
      {!isLoading && allPendingIds.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <span className="text-sm font-medium text-text-primary">
            {allPendingIds.length} pending across all types
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => batchBulkReview(allPendingIds, "approved")}
              disabled={bulkLoading}
              className="rounded-md bg-status-success-fg px-3 py-1.5 text-sm font-medium text-text-on-brand hover:opacity-90 disabled:opacity-50"
            >
              {bulkLoading ? "Processing..." : `Approve All ${allPendingIds.length} Findings`}
            </button>
            <button
              onClick={() => batchBulkReview(allPendingIds, "rejected")}
              disabled={bulkLoading}
              className="rounded-md bg-status-error-fg px-3 py-1.5 text-sm font-medium text-text-on-brand hover:opacity-90 disabled:opacity-50"
            >
              {bulkLoading ? "Processing..." : `Reject All ${allPendingIds.length} Findings`}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border-default">
        {TABS.map((tab) => {
          const count = grouped[tab.type]?.length ?? 0;
          const isActive = activeTab === tab.type;
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent-default text-accent-default"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    isActive
                      ? "bg-status-warning-bg text-status-warning-fg"
                      : "bg-surface-elevated text-text-secondary"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bulk actions */}
      {pendingIds.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-text-secondary">{pendingIds.length} pending:</span>
          <button
            onClick={handleBulkApprove}
            disabled={bulkLoading}
            className="rounded-md bg-status-success-fg px-2.5 py-1 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-50"
          >
            Approve All {activeTabLabel}
          </button>
          <button
            onClick={handleBulkReject}
            disabled={bulkLoading}
            className="rounded-md bg-status-error-fg px-2.5 py-1 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-50"
          >
            Reject All {activeTabLabel}
          </button>
        </div>
      )}

      {/* Findings list */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-secondary">Loading findings...</div>
      ) : currentItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default p-8 text-center">
          <p className="text-sm text-text-secondary">No {activeTab} findings extracted.</p>
        </div>
      ) : (
        <div className="max-h-[400px] space-y-2 overflow-y-auto">
          {currentItems.map((finding) => {
            const data = (finding.editedData ?? finding.data) as Record<string, unknown>;
            const sourceAttribution = (finding.sourceAttribution ?? {}) as Record<string, unknown>;
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
              (typeof sourceSpeaker?.speakerId === "string" ? sourceSpeaker.speakerId : null);
            const keyframeUrl =
              Array.isArray(sourceAttribution.sourceKeyframeUrls) &&
              typeof sourceAttribution.sourceKeyframeUrls[0] === "string"
                ? sourceAttribution.sourceKeyframeUrls[0]
                : null;
            const title =
              typeof data?.title === "string"
                ? data.title
                : typeof data?.name === "string"
                  ? data.name
                  : "Untitled";

            return (
              <div
                key={finding._id}
                className="rounded-lg border border-border-default bg-surface-raised p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-medium text-text-heading">{title}</h4>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[finding.confidence]}`}
                      >
                        {finding.confidence}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[finding.status]}`}
                      >
                        {finding.status}
                      </span>
                    </div>
                    {finding.sourceExcerpt && (
                      <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                        {finding.sourceExcerpt}
                      </p>
                    )}
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
                  {finding.status === "pending" && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleReview(finding._id, "approved")}
                        className="rounded-md bg-status-success-fg px-2 py-1 text-xs font-medium text-text-on-brand hover:opacity-90"
                        title="Approve"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleReview(finding._id, "rejected")}
                        className="rounded-md bg-status-error-fg px-2 py-1 text-xs font-medium text-text-on-brand hover:opacity-90"
                        title="Reject"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPendingWarning && allPendingIds.length > 0 && (
        <div className="mt-4 rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-3">
          <p className="text-sm text-status-warning-fg">
            You have <span className="font-semibold">{allPendingIds.length}</span> pending findings
            that won&apos;t be imported.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                setShowPendingWarning(false);
                onNext();
              }}
              className="rounded-md bg-accent-default px-3 py-1.5 text-sm font-medium text-text-on-brand hover:bg-accent-strong"
            >
              Continue Anyway
            </button>
            <button
              onClick={() => setShowPendingWarning(false)}
              className="rounded-md border border-status-warning-border px-3 py-1.5 text-sm font-medium text-status-warning-fg hover:bg-status-warning-bg"
            >
              Go Back to Review
            </button>
          </div>
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
          onClick={() => {
            if (allPendingIds.length > 0 && !showPendingWarning) {
              setShowPendingWarning(true);
            } else {
              onNext();
            }
          }}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong"
        >
          Next
        </button>
      </div>
    </div>
  );
}
