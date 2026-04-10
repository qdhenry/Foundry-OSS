"use client";

import Link from "next/link";
import { useProgramContext } from "../programs";

type SprintStatus = "planning" | "active" | "completed" | "cancelled";

interface SprintCardProps {
  sprint: {
    _id: string;
    name: string;
    number: number;
    status: SprintStatus;
    startDate?: number;
    endDate?: number;
    goal?: string;
    workstreamId: string;
  };
  programId: string;
  workstreamName?: string;
}

const STATUS_BADGE: Record<SprintStatus, { label: string; classes: string }> = {
  planning: {
    label: "Planning",
    classes: "bg-surface-elevated text-text-primary",
  },
  active: {
    label: "Active",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  completed: {
    label: "Completed",
    classes: "bg-status-info-bg text-status-info-fg",
  },
  cancelled: {
    label: "Cancelled",
    classes: "bg-status-error-bg text-status-error-fg",
  },
};

function formatDate(ts?: number): string {
  if (!ts) return "--";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SprintCard({ sprint, workstreamName }: SprintCardProps) {
  const { slug } = useProgramContext();
  const statusBadge = STATUS_BADGE[sprint.status];
  const isActive = sprint.status === "active";

  return (
    <Link
      href={`/${slug}/sprints/${sprint._id}`}
      className={`block rounded-xl border bg-surface-default p-4 transition-all hover:border-accent-default hover:shadow-md ${
        isActive
          ? "border-l-4 border-l-accent-default border-t-border-default border-r-border-default border-b-border-default"
          : "border-border-default"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-text-heading">{sprint.name}</h3>
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
            #{sprint.number}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.classes}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        {workstreamName && <span>{workstreamName}</span>}
        {(sprint.startDate || sprint.endDate) && (
          <>
            {workstreamName && <span className="text-text-muted">|</span>}
            <span>
              {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
            </span>
          </>
        )}
      </div>

      {sprint.goal && <p className="line-clamp-2 text-sm text-text-secondary">{sprint.goal}</p>}
    </Link>
  );
}
