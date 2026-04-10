"use client";

import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { WorkstreamHealthPanel } from "./WorkstreamHealthPanel";

type WorkstreamStatus = "on_track" | "at_risk" | "blocked";

export interface Workstream {
  _id: string;
  name: string;
  shortCode: string;
  status: WorkstreamStatus;
  currentSprint?: number;
}

type HealthScoreResult = {
  health: string;
  healthScore: number;
} | null;

interface WorkstreamGridProps {
  workstreams: Workstream[];
  programId: string;
}

const STATUS_CONFIG: Record<
  WorkstreamStatus,
  { dot: string; border: string; label: string; badge: string }
> = {
  on_track: {
    dot: "bg-status-success-fg",
    border: "border-l-status-success-fg",
    label: "On Track",
    badge: "bg-status-success-bg text-status-success-fg",
  },
  at_risk: {
    dot: "bg-status-warning-fg",
    border: "border-l-status-warning-fg",
    label: "At Risk",
    badge: "bg-status-warning-bg text-status-warning-fg",
  },
  blocked: {
    dot: "bg-status-error-fg",
    border: "border-l-status-error-fg",
    label: "Blocked",
    badge: "bg-status-error-bg text-status-error-fg",
  },
};

function WorkstreamCard({
  workstream,
  onSelect,
}: {
  workstream: Workstream;
  onSelect: (ws: Workstream) => void;
}) {
  const config = STATUS_CONFIG[workstream.status] ?? STATUS_CONFIG.on_track;

  const latestScore = useQuery("healthScoring:getLatestHealthScore" as any, {
    workstreamId: workstream._id,
  }) as HealthScoreResult | undefined;

  return (
    <button
      onClick={() => onSelect(workstream)}
      className={`w-full rounded-xl border border-l-4 border-border-default bg-surface-default p-4 text-left transition-colors hover:bg-interactive-hover ${config.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">{workstream.shortCode}</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.badge}`}>
            {config.label}
          </span>
          {latestScore && (
            <span className="text-xs font-bold text-text-primary">
              {latestScore.healthScore}/100
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-text-heading">{workstream.name}</p>
      <p className="mt-1 text-xs text-text-muted">Sprint {workstream.currentSprint ?? 1}</p>
    </button>
  );
}

export function WorkstreamGrid({ workstreams, programId }: WorkstreamGridProps) {
  const [selectedWs, setSelectedWs] = useState<Workstream | null>(null);

  const handleClose = useCallback(() => setSelectedWs(null), []);

  if (workstreams.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-8 text-center">
        <p className="text-sm text-text-secondary">No workstreams created yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workstreams.map((ws) => (
          <WorkstreamCard key={ws._id} workstream={ws} onSelect={setSelectedWs} />
        ))}
      </div>

      {selectedWs && (
        <WorkstreamHealthPanel
          workstreamId={selectedWs._id}
          workstreamName={selectedWs.name}
          open={!!selectedWs}
          onClose={handleClose}
        />
      )}
    </>
  );
}
