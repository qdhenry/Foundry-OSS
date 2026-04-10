"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useProgramContext } from "../programs/ProgramContext";
import { ImplementationBadge } from "./ImplementationBadge";

interface AnalysisRunDetailProps {
  runId: string;
}

export function AnalysisRunDetail({ runId }: AnalysisRunDetailProps) {
  const { slug } = useProgramContext();
  const results = useQuery("codebaseRequirementAnalysis:getRunResults" as any, { runId }) as
    | any[]
    | undefined;

  const approveResult = useMutation("codebaseRequirementAnalysis:approveResult" as any);
  const rejectResult = useMutation("codebaseRequirementAnalysis:rejectResult" as any);

  if (results === undefined) {
    return (
      <div className="flex h-20 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (results.length === 0) {
    return <p className="py-4 text-center text-sm text-text-muted">No results yet.</p>;
  }

  return (
    <div className="space-y-2">
      {results.map((result: any) => (
        <div
          key={result._id}
          className="flex items-start gap-3 rounded-md border border-border-default bg-surface-raised px-3 py-2.5"
        >
          <ImplementationBadge
            status={result.implementationStatus}
            confidence={result.confidence}
            lastAnalyzedAt={result._creationTime}
          />

          <div className="min-w-0 flex-1">
            {result.requirementRefId && (
              <Link
                href={`/${slug}/requirements`}
                className="mb-0.5 block text-xs font-medium text-accent-default hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {result.requirementRefId} — {result.requirementTitle}
              </Link>
            )}
            <p className="text-sm font-medium text-text-primary">{result.confidenceReasoning}</p>
            {result.gapDescription && (
              <p className="mt-1 text-xs text-status-warning-fg">Gap: {result.gapDescription}</p>
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

          {/* Review status */}
          {result.reviewStatus === "pending_review" && (
            <span className="shrink-0 rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-fg">
              Pending Review
            </span>
          )}
          {result.reviewStatus === "regression_flagged" && (
            <span className="shrink-0 rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
              Regression
            </span>
          )}
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

          {(result.reviewStatus === "pending_review" ||
            result.reviewStatus === "regression_flagged") && (
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
          )}
        </div>
      ))}
    </div>
  );
}
