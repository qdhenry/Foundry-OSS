"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useCallback, useState } from "react";
import { ImplementationBadge } from "./ImplementationBadge";

interface ReviewQueueProps {
  programId: string;
}

export function ReviewQueue({ programId }: ReviewQueueProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const pendingResults = useQuery(
    "codebaseRequirementAnalysis:getPendingReviews" as any,
    orgId ? { orgId, programId } : "skip",
  ) as any[] | undefined;

  const regressions = useQuery(
    "codebaseRequirementAnalysis:getRegressionFlags" as any,
    orgId ? { orgId, programId } : "skip",
  ) as any[] | undefined;

  const approveResult = useMutation("codebaseRequirementAnalysis:approveResult" as any);
  const rejectResult = useMutation("codebaseRequirementAnalysis:rejectResult" as any);
  const bulkApprove = useMutation("codebaseRequirementAnalysis:bulkApprove" as any);
  const bulkReject = useMutation("codebaseRequirementAnalysis:bulkReject" as any);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allResults = [...(regressions ?? []), ...(pendingResults ?? [])];

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    await bulkApprove({ resultIds: Array.from(selectedIds) });
    setSelectedIds(new Set());
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    await bulkReject({ resultIds: Array.from(selectedIds) });
    setSelectedIds(new Set());
  };

  if (!allResults.length) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 text-center">
        <p className="text-sm text-text-secondary">
          No pending reviews. All analysis results have been processed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-accent-default bg-accent-default/5 px-4 py-2">
          <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkApprove}
            className="flex items-center gap-1 rounded-md bg-status-success-bg px-3 py-1 text-xs font-medium text-status-success-fg hover:opacity-80"
          >
            <Check className="h-3 w-3" />
            Approve All
          </button>
          <button
            onClick={handleBulkReject}
            className="flex items-center gap-1 rounded-md bg-status-error-bg px-3 py-1 text-xs font-medium text-status-error-fg hover:opacity-80"
          >
            <X className="h-3 w-3" />
            Reject All
          </button>
        </div>
      )}

      {/* Results list */}
      {allResults.map((result: any) => {
        const isExpanded = expandedId === result._id;
        const isRegression = result.reviewStatus === "regression_flagged";

        return (
          <div
            key={result._id}
            className={`rounded-lg border ${
              isRegression
                ? "border-status-error-border bg-status-error-bg/20"
                : "border-border-default bg-surface-default"
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.has(result._id)}
                onChange={() => toggleSelect(result._id)}
                className="rounded border-border-default"
              />

              <button
                onClick={() => setExpandedId(isExpanded ? null : result._id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <ImplementationBadge
                  status={result.implementationStatus}
                  confidence={result.confidence}
                  lastAnalyzedAt={result._creationTime}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {result.confidenceReasoning}
                  </p>
                  {result.proposedStatus && (
                    <p className="text-xs text-text-secondary">
                      Proposed: {result.previousStatus} → {result.proposedStatus}
                    </p>
                  )}
                </div>

                {isRegression && (
                  <span className="shrink-0 rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
                    Regression
                  </span>
                )}

                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-muted" />
                )}
              </button>

              {/* Inline approve/reject */}
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => approveResult({ resultId: result._id })}
                  className="rounded-md p-1.5 text-status-success-fg hover:bg-status-success-bg"
                  title="Approve"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => rejectResult({ resultId: result._id })}
                  className="rounded-md p-1.5 text-status-error-fg hover:bg-status-error-bg"
                  title="Reject"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Expanded evidence */}
            {isExpanded && result.evidence?.files?.length > 0 && (
              <div className="border-t border-border-default px-4 py-3">
                <h4 className="mb-2 text-xs font-semibold text-text-secondary">Evidence</h4>
                {result.evidence.files.map((f: any, i: number) => (
                  <div key={i} className="mb-2">
                    <span className="font-mono text-xs text-text-primary">
                      {f.filePath}
                      {f.lineStart && `:${f.lineStart}-${f.lineEnd}`}
                    </span>
                    <p className="text-xs text-text-secondary">{f.relevance}</p>
                    {f.snippet && (
                      <pre className="mt-1 overflow-x-auto rounded bg-surface-raised p-2 text-xs text-text-primary">
                        {f.snippet}
                      </pre>
                    )}
                  </div>
                ))}
                {result.gapDescription && (
                  <div className="mt-2 rounded bg-status-warning-bg/50 p-2">
                    <p className="text-xs font-medium text-status-warning-fg">
                      Gap: {result.gapDescription}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
