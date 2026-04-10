"use client";

import Link from "next/link";
import { useProgramContext } from "../programs";

type GateType = "foundation" | "development" | "integration" | "release";
type GateStatus = "pending" | "passed" | "failed" | "overridden";

interface Criterion {
  title: string;
  description?: string;
  passed: boolean;
  evidence?: string;
}

interface GateCardProps {
  gate: {
    _id: string;
    name: string;
    gateType: GateType;
    status: GateStatus;
    criteria: Criterion[];
    workstreamId: string;
  };
  programId: string;
  workstreamName?: string;
}

const TYPE_BADGE: Record<GateType, { label: string; classes: string }> = {
  foundation: { label: "Foundation", classes: "bg-surface-elevated text-text-primary" },
  development: { label: "Development", classes: "bg-status-info-bg text-accent-default" },
  integration: { label: "Integration", classes: "bg-status-success-bg text-status-success-fg" },
  release: { label: "Release", classes: "bg-status-warning-bg text-status-warning-fg" },
};

const STATUS_BADGE: Record<GateStatus, { label: string; classes: string }> = {
  pending: { label: "Pending", classes: "bg-status-warning-bg text-status-warning-fg" },
  passed: { label: "Passed", classes: "bg-status-success-bg text-status-success-fg" },
  failed: { label: "Failed", classes: "bg-status-error-bg text-status-error-fg" },
  overridden: { label: "Overridden", classes: "bg-status-warning-bg text-status-warning-fg" },
};

export function GateCard({ gate, programId, workstreamName }: GateCardProps) {
  const { slug } = useProgramContext();
  const passedCount = gate.criteria.filter((c) => c.passed).length;
  const totalCount = gate.criteria.length;
  const progressPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const typeBadge = TYPE_BADGE[gate.gateType];
  const statusBadge = STATUS_BADGE[gate.status];

  return (
    <Link
      href={`/${slug}/gates/${gate._id}`}
      className="block rounded-xl border border-border-default bg-surface-default p-4 transition-all hover:border-accent-default hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-medium text-text-heading">{gate.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.classes}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge.classes}`}>
          {typeBadge.label}
        </span>
        {workstreamName && <span className="text-xs text-text-secondary">{workstreamName}</span>}
      </div>

      {/* Criteria progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
          <span>Criteria</span>
          <span>
            {passedCount}/{totalCount} passed
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`h-full rounded-full transition-all ${
              progressPercent === 100
                ? "bg-green-500"
                : progressPercent > 0
                  ? "bg-accent-default"
                  : "bg-surface-elevated"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
