"use client";

import type { ReactNode } from "react";
import { FindingCard, type FindingData } from "./FindingCard";

interface FindingGroupProps {
  type: "requirement" | "risk" | "integration" | "decision";
  findings: FindingData[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
  onBulkApprove: (ids: string[]) => void;
  onBulkReject: (ids: string[]) => void;
}

const GROUP_HEADER: Record<FindingGroupProps["type"], { label: string; icon: ReactNode }> = {
  requirement: {
    label: "Requirements",
    icon: (
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
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  risk: {
    label: "Risks",
    icon: (
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
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
    ),
  },
  integration: {
    label: "Integrations",
    icon: (
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
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
  },
  decision: {
    label: "Decisions",
    icon: (
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
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
};

export function FindingGroup({
  type,
  findings,
  onApprove,
  onReject,
  onEdit,
  onBulkApprove,
  onBulkReject,
}: FindingGroupProps) {
  const header = GROUP_HEADER[type];
  const pendingFindings = findings.filter((f) => f.status === "pending");
  const pendingIds = pendingFindings.map((f) => f._id);
  const hasPending = pendingIds.length > 0;

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default px-6 py-8 text-center">
        <p className="text-sm text-text-secondary">No {header.label.toLowerCase()} found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Group header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">{header.icon}</span>
          <h3 className="text-sm font-semibold text-text-heading">{header.label}</h3>
          <span className="inline-flex items-center rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
            {findings.length}
          </span>
        </div>

        {/* Bulk actions */}
        {hasPending && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onBulkApprove(pendingIds)}
              className="rounded-lg bg-status-success-fg px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:opacity-90"
              aria-label={`Approve all pending ${header.label.toLowerCase()}`}
            >
              Approve All ({pendingIds.length})
            </button>
            <button
              onClick={() => onBulkReject(pendingIds)}
              className="rounded-lg bg-status-error-fg px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:opacity-90"
              aria-label={`Reject all pending ${header.label.toLowerCase()}`}
            >
              Reject All ({pendingIds.length})
            </button>
          </div>
        )}
      </div>

      {/* Finding cards */}
      <div className="space-y-3">
        {findings.map((finding) => (
          <FindingCard
            key={finding._id}
            finding={finding}
            onApprove={onApprove}
            onReject={onReject}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
