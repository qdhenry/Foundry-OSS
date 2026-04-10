"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

type ReviewStatus = "pending" | "accepted" | "revised" | "rejected";

interface ExecutionOutputProps {
  executionId: string;
  output: string;
  skillName?: string | null;
  tokensUsed?: number | null;
  durationMs?: number | null;
  reviewStatus: ReviewStatus;
}

const REVIEW_BADGE: Record<ReviewStatus, { label: string; classes: string }> = {
  pending: {
    label: "Pending Review",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  accepted: {
    label: "Accepted",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  revised: {
    label: "Revised",
    classes: "bg-status-info-bg text-accent-default",
  },
  rejected: {
    label: "Rejected",
    classes: "bg-status-error-bg text-status-error-fg",
  },
};

export function ExecutionOutput({
  executionId,
  output,
  skillName,
  tokensUsed,
  durationMs,
  reviewStatus,
}: ExecutionOutputProps) {
  const updateReview = useMutation(api.agentExecutions.updateReview);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ReviewStatus>(reviewStatus);

  async function handleReview(status: "accepted" | "revised" | "rejected") {
    setIsUpdating(true);
    try {
      await updateReview({
        executionId: executionId as any,
        reviewStatus: status,
      });
      setCurrentStatus(status);
    } finally {
      setIsUpdating(false);
    }
  }

  const badge = REVIEW_BADGE[currentStatus];

  return (
    <div className="space-y-4">
      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        {skillName && (
          <span className="rounded-full bg-status-success-bg px-2 py-0.5 font-medium text-status-success-fg">
            {skillName}
          </span>
        )}
        {tokensUsed != null && <span>{tokensUsed.toLocaleString()} tokens</span>}
        {durationMs != null && <span>{(durationMs / 1000).toFixed(1)}s</span>}
        <span className={`rounded-full px-2 py-0.5 font-medium ${badge.classes}`}>
          {badge.label}
        </span>
      </div>

      {/* Output */}
      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-border-default bg-surface-raised p-4">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-heading">
          {output}
        </pre>
      </div>

      {/* Review actions */}
      {currentStatus === "pending" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleReview("accepted")}
            disabled={isUpdating}
            className="rounded-lg bg-status-success-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => handleReview("revised")}
            disabled={isUpdating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Revise
          </button>
          <button
            onClick={() => handleReview("rejected")}
            disabled={isUpdating}
            className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
