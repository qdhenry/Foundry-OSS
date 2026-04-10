"use client";

import { useRouter } from "next/navigation";
import { useProgramContext } from "@/lib/programContext";

type Severity = "critical" | "high" | "medium" | "low";
type Probability = "very_likely" | "likely" | "possible" | "unlikely";
type Status = "open" | "mitigating" | "resolved" | "accepted";

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PROBABILITY_BADGE: Record<Probability, string> = {
  very_likely: "bg-status-error-bg text-status-error-fg",
  likely: "bg-status-warning-bg text-status-warning-fg",
  possible: "bg-status-warning-bg text-status-warning-fg",
  unlikely: "bg-surface-elevated text-text-secondary",
};

const PROBABILITY_LABEL: Record<Probability, string> = {
  very_likely: "Very Likely",
  likely: "Likely",
  possible: "Possible",
  unlikely: "Unlikely",
};

const STATUS_BADGE: Record<Status, string> = {
  open: "bg-status-info-bg text-accent-default",
  mitigating: "bg-status-warning-bg text-status-warning-fg",
  resolved: "bg-status-success-bg text-status-success-fg",
  accepted: "bg-surface-elevated text-text-secondary",
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  mitigating: "Mitigating",
  resolved: "Resolved",
  accepted: "Accepted",
};

interface RiskCardProps {
  risk: {
    _id: string;
    title: string;
    description?: string;
    severity: Severity;
    probability: Probability;
    status: Status;
    ownerName?: string;
    resolvedWorkstreams?: { _id: string; name: string; shortCode: string }[];
  };
  programId: string;
}

export function RiskCard({ risk, programId }: RiskCardProps) {
  const { slug } = useProgramContext();
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/${slug}/risks/${risk._id}`)}
      className="cursor-pointer rounded-xl border border-border-default bg-surface-default p-4 transition-all hover:border-accent-default hover:shadow-md"
    >
      {/* Title + status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-heading line-clamp-2">{risk.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[risk.status]}`}
        >
          {STATUS_LABEL[risk.status]}
        </span>
      </div>

      {/* Description preview */}
      {risk.description && (
        <p className="mb-3 text-xs text-text-secondary line-clamp-2">{risk.description}</p>
      )}

      {/* Severity + Probability badges */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[risk.severity]}`}
        >
          {SEVERITY_LABEL[risk.severity]}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROBABILITY_BADGE[risk.probability]}`}
        >
          {PROBABILITY_LABEL[risk.probability]}
        </span>
      </div>

      {/* Workstream tags */}
      {risk.resolvedWorkstreams && risk.resolvedWorkstreams.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {risk.resolvedWorkstreams.map((ws) => (
            <span
              key={ws._id}
              className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary"
            >
              {ws.shortCode}
            </span>
          ))}
        </div>
      )}

      {/* Owner */}
      {risk.ownerName && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {risk.ownerName}
        </div>
      )}
    </div>
  );
}
