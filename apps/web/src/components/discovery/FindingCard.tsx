"use client";

import { type ReactNode, useState } from "react";

export interface FindingData {
  _id: string;
  type: "requirement" | "risk" | "integration" | "decision";
  status: "pending" | "approved" | "rejected" | "imported" | "edited";
  data: Record<string, unknown>;
  editedData?: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  suggestedWorkstream?: string;
  sourceExcerpt?: string;
  documentName?: string;
}

interface FindingCardProps {
  finding: FindingData;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
}

const TYPE_BADGE: Record<FindingData["type"], { label: string; classes: string }> = {
  requirement: {
    label: "Requirement",
    classes: "bg-status-info-bg text-status-info-fg",
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
};

const CONFIDENCE_BADGE: Record<FindingData["confidence"], { label: string; classes: string }> = {
  high: {
    label: "High",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  medium: {
    label: "Medium",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  low: {
    label: "Low",
    classes: "bg-status-error-bg text-status-error-fg",
  },
};

const STATUS_INDICATOR: Record<string, { icon: ReactNode; classes: string }> = {
  approved: {
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    classes: "text-status-success-fg",
  },
  rejected: {
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    classes: "text-status-error-fg",
  },
  edited: {
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
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    ),
    classes: "text-status-info-fg",
  },
  imported: {
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    classes: "text-status-success-fg",
  },
};

export function FindingCard({ finding, onApprove, onReject, onEdit }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayData = (finding.editedData ?? finding.data) as Record<string, unknown>;
  const title =
    typeof displayData.title === "string"
      ? displayData.title
      : typeof displayData.name === "string"
        ? displayData.name
        : "Untitled";
  const description = typeof displayData.description === "string" ? displayData.description : null;

  const typeBadge = TYPE_BADGE[finding.type];
  const confidenceBadge = CONFIDENCE_BADGE[finding.confidence];
  const statusIndicator = STATUS_INDICATOR[finding.status];
  const isPending = finding.status === "pending";

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      {/* Top row: badges + status */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge.classes}`}
        >
          {typeBadge.label}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadge.classes}`}
        >
          {confidenceBadge.label}
        </span>
        {finding.suggestedWorkstream && (
          <span className="inline-flex items-center rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
            {finding.suggestedWorkstream}
          </span>
        )}
        {statusIndicator && (
          <span
            className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${statusIndicator.classes}`}
          >
            {statusIndicator.icon}
            <span className="capitalize">{finding.status}</span>
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="mb-1 text-sm font-semibold text-text-heading">{title}</h4>

      {/* Description with expand/collapse */}
      {description && (
        <div className="mb-2">
          <p className={`text-xs text-text-secondary ${!expanded ? "line-clamp-2" : ""}`}>
            {description}
          </p>
          {description.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 text-xs font-medium text-accent-default hover:text-accent-strong"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Source excerpt */}
      {finding.sourceExcerpt && (
        <div className="mb-3 rounded-lg border-l-2 border-border-default bg-surface-raised px-3 py-2">
          <p className="text-xs italic text-text-secondary line-clamp-3">{finding.sourceExcerpt}</p>
        </div>
      )}

      {/* Action buttons — only for pending */}
      {isPending && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onApprove(finding._id)}
            className="rounded-lg bg-status-success-fg px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:opacity-90"
            aria-label={`Approve finding: ${title}`}
          >
            Approve
          </button>
          <button
            onClick={() => onReject(finding._id)}
            className="rounded-lg bg-status-error-fg px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:opacity-90"
            aria-label={`Reject finding: ${title}`}
          >
            Reject
          </button>
          <button
            onClick={() => onEdit(finding._id)}
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-interactive-hover"
            aria-label={`Edit finding: ${title}`}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
