"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useProgramContext } from "../programs/ProgramContext";
import { AnalysisRunTimeline } from "./AnalysisRunTimeline";
import { ImplementationBadge } from "./ImplementationBadge";
import { ReviewQueue } from "./ReviewQueue";

type StatusFilter =
  | "fully_implemented"
  | "partially_implemented"
  | "not_found"
  | "needs_verification";

const STATUS_LABELS: Record<StatusFilter, string> = {
  fully_implemented: "Fully Implemented",
  partially_implemented: "Partially Implemented",
  not_found: "Not Found",
  needs_verification: "Needs Verification",
};

export function ProgramAnalysisPage() {
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const { programId, slug } = useProgramContext();

  const [selectedStatus, setSelectedStatus] = useState<StatusFilter | null>(null);

  const runs = useQuery(
    "codebaseRequirementAnalysis:listRunsByProgram" as any,
    isAuthenticated && orgId ? { orgId, programId: String(programId) } : "skip",
  ) as any[] | undefined;

  const pendingCount = useQuery(
    "codebaseRequirementAnalysis:getPendingReviews" as any,
    isAuthenticated && orgId ? { orgId, programId: String(programId) } : "skip",
  ) as any[] | undefined;

  const allResults = useQuery(
    "codebaseRequirementAnalysis:getResultsByProgramWithRequirements" as any,
    isAuthenticated && orgId ? { orgId, programId: String(programId) } : "skip",
  ) as any[] | undefined;

  const approveResult = useMutation("codebaseRequirementAnalysis:approveResult" as any);
  const rejectResult = useMutation("codebaseRequirementAnalysis:rejectResult" as any);

  // Calculate summary stats from completed runs
  const latestCompleted = runs?.find((r: any) => r.status === "completed");
  const summary = latestCompleted?.summary;

  // Deduplicate to latest result per requirement, then filter by selected status
  const filteredResults = useMemo(() => {
    if (!selectedStatus || !allResults) return [];

    // Group by requirementId, keep latest (_creationTime desc, results already ordered desc)
    const latestByReq = new Map<string, any>();
    for (const r of allResults) {
      if (!latestByReq.has(r.requirementId)) {
        latestByReq.set(r.requirementId, r);
      }
    }

    return Array.from(latestByReq.values()).filter(
      (r) => r.implementationStatus === selectedStatus,
    );
  }, [selectedStatus, allResults]);

  function toggleStatus(status: StatusFilter) {
    setSelectedStatus((prev) => (prev === status ? null : status));
  }

  const statusCards: Array<{
    key: StatusFilter;
    count: number;
    border: string;
    bg: string;
    text: string;
    ring: string;
    label: string;
  }> = [
    {
      key: "fully_implemented",
      count: summary?.fullyImplemented ?? 0,
      border: "border-status-success-border",
      bg: "bg-status-success-bg/30",
      text: "text-status-success-fg",
      ring: "ring-status-success-border",
      label: "Fully Implemented",
    },
    {
      key: "partially_implemented",
      count: summary?.partiallyImplemented ?? 0,
      border: "border-status-warning-border",
      bg: "bg-status-warning-bg/30",
      text: "text-status-warning-fg",
      ring: "ring-status-warning-border",
      label: "Partially Implemented",
    },
    {
      key: "not_found",
      count: summary?.notFound ?? 0,
      border: "border-status-error-border",
      bg: "bg-status-error-bg/30",
      text: "text-status-error-fg",
      ring: "ring-status-error-border",
      label: "Not Found",
    },
    {
      key: "needs_verification",
      count: summary?.needsVerification ?? 0,
      border: "border-status-info-border",
      bg: "bg-status-info-bg/30",
      text: "text-status-info-fg",
      ring: "ring-status-info-border",
      label: "Needs Verification",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="type-display-m text-text-heading">Implementation Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track implementation status of requirements across all workstreams.
        </p>
      </div>

      {/* Summary dashboard — clickable cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {statusCards.map((card) => (
            <button
              key={card.key}
              onClick={() => toggleStatus(card.key)}
              className={`rounded-lg border p-4 text-left transition-all ${card.border} ${card.bg} cursor-pointer hover:shadow-sm ${
                selectedStatus === card.key ? `ring-2 ${card.ring}` : ""
              }`}
            >
              <p className={`text-2xl font-bold ${card.text}`}>{card.count}</p>
              <p className="text-xs text-text-secondary">{card.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filtered results by status */}
      {selectedStatus && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-heading">
              {STATUS_LABELS[selectedStatus]} ({filteredResults.length})
            </h2>
            <button
              onClick={() => setSelectedStatus(null)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Clear filter
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="rounded-xl border border-border-default bg-surface-secondary p-6 text-center">
              <p className="text-sm text-text-secondary">
                No requirements with this status in the latest analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResults.map((result: any) => {
                const isActionable =
                  result.reviewStatus === "pending_review" ||
                  result.reviewStatus === "regression_flagged";

                return (
                  <div
                    key={result._id}
                    className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-default px-4 py-3"
                  >
                    <ImplementationBadge
                      status={result.implementationStatus}
                      confidence={result.confidence}
                      lastAnalyzedAt={result._creationTime}
                    />

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/${slug}/requirements`}
                        className="mb-0.5 block text-xs font-medium text-accent-default hover:underline"
                      >
                        {result.requirementRefId} — {result.requirementTitle}
                      </Link>
                      <p className="text-sm text-text-primary">{result.confidenceReasoning}</p>
                      {result.gapDescription && (
                        <p className="mt-1 text-xs text-status-warning-fg">
                          Gap: {result.gapDescription}
                        </p>
                      )}
                      {result.evidence?.files?.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {result.evidence.files.slice(0, 3).map((f: any, i: number) => (
                            <div key={i} className="text-xs text-text-muted">
                              <span className="font-mono">{f.filePath}</span>
                              {f.lineStart && (
                                <span>
                                  :{f.lineStart}-{f.lineEnd}
                                </span>
                              )}
                              <span className="ml-2 text-text-secondary">{f.relevance}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Review status + actions */}
                    {result.reviewStatus === "auto_applied" && (
                      <span className="shrink-0 rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
                        Applied
                      </span>
                    )}
                    {result.reviewStatus === "approved" && (
                      <span className="shrink-0 rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
                        Approved
                      </span>
                    )}
                    {result.reviewStatus === "rejected" && (
                      <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-muted">
                        Rejected
                      </span>
                    )}
                    {isActionable && (
                      <div className="flex shrink-0 items-center gap-1">
                        {result.reviewStatus === "regression_flagged" && (
                          <span className="mr-1 rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
                            Regression
                          </span>
                        )}
                        {result.reviewStatus === "pending_review" && (
                          <span className="mr-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-fg">
                            Pending
                          </span>
                        )}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending reviews — always visible */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-heading">
          Pending Reviews ({pendingCount?.length ?? 0})
        </h2>
        <ReviewQueue programId={String(programId)} />
      </div>

      {/* Run history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-heading">Analysis History</h2>
        {runs === undefined ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          </div>
        ) : (
          <AnalysisRunTimeline runs={runs} />
        )}
      </div>
    </div>
  );
}
