"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useProgramContext } from "@/lib/programContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Workstream {
  _id: Id<"workstreams">;
  name: string;
  shortCode: string;
  status: "on_track" | "at_risk" | "blocked";
  currentSprint?: number;
}

interface WorkstreamGridProps {
  workstreams: Workstream[];
  programId: Id<"programs">;
}

const STATUS_CONFIG: Record<string, { dot: string; border: string; label: string }> = {
  on_track: {
    dot: "bg-status-success-fg",
    border: "border-l-status-success-fg",
    label: "On Track",
  },
  at_risk: {
    dot: "bg-status-warning-fg",
    border: "border-l-status-warning-fg",
    label: "At Risk",
  },
  blocked: {
    dot: "bg-status-error-fg",
    border: "border-l-status-error-fg",
    label: "Blocked",
  },
};

export function WorkstreamGrid({ workstreams, programId }: WorkstreamGridProps) {
  const { slug } = useProgramContext();
  const dependencies = useQuery(api.workstreamDependencies.listByProgram, { programId });

  // Compute per-workstream dependency counts (incoming + outgoing)
  const depCountMap = new Map<string, number>();
  if (dependencies) {
    for (const dep of dependencies) {
      depCountMap.set(dep.sourceWorkstreamId, (depCountMap.get(dep.sourceWorkstreamId) ?? 0) + 1);
      depCountMap.set(dep.targetWorkstreamId, (depCountMap.get(dep.targetWorkstreamId) ?? 0) + 1);
    }
  }

  if (workstreams.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-8 text-center">
        <p className="text-sm text-text-secondary">No workstreams created yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workstreams.map((ws) => {
        const config = STATUS_CONFIG[ws.status] ?? STATUS_CONFIG.on_track;
        const depCount = depCountMap.get(ws._id) ?? 0;
        return (
          <Link
            key={ws._id}
            href={`/${slug}/workstreams/${ws._id}`}
            className={`rounded-xl border border-l-4 border-border-default bg-surface-default p-4 transition-colors hover:bg-interactive-hover ${config.border}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">{ws.shortCode}</span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${config.dot}`} />
                <span className="text-xs text-text-secondary">{config.label}</span>
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-text-heading">{ws.name}</p>
            <p className="mt-1 text-xs text-text-muted">Sprint {ws.currentSprint ?? 1}</p>
            {depCount > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <svg
                  className="h-3 w-3 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.182-9.182l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757"
                  />
                </svg>
                <span className="text-xs text-text-muted">
                  {depCount} dep{depCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
