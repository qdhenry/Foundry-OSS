// packages/ui/src/activity/WorkstreamGrid.tsx
"use client";

import type { EnrichedExecution } from "./utils";

interface WorkstreamEntry {
  name: string;
  workstreamId: string;
  executionCount: number;
}

interface WorkstreamGridProps {
  executions: EnrichedExecution[];
  onDrillDown: (workstreamId: string, workstreamName: string) => void;
}

export function WorkstreamGrid({ executions, onDrillDown }: WorkstreamGridProps) {
  const workstreams = new Map<string, WorkstreamEntry>();

  for (const exec of executions) {
    if (!exec.workstreamId || !exec.workstreamName) continue;
    const existing = workstreams.get(exec.workstreamId);
    if (existing) {
      existing.executionCount++;
    } else {
      workstreams.set(exec.workstreamId, {
        name: exec.workstreamName,
        workstreamId: exec.workstreamId,
        executionCount: 1,
      });
    }
  }

  const sorted = Array.from(workstreams.values()).sort(
    (a, b) => b.executionCount - a.executionCount,
  );

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="type-body-s mb-3 font-semibold text-text-heading">Workstream Coverage</h2>
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((ws) => {
          const colorClass =
            ws.executionCount >= 5
              ? "text-status-success-fg"
              : ws.executionCount >= 1
                ? "text-status-warning-fg"
                : "text-status-error-fg";

          return (
            <button
              key={ws.workstreamId}
              onClick={() => onDrillDown(ws.workstreamId, ws.name)}
              className="card-interactive flex items-center justify-between p-3"
            >
              <span className="type-body-s text-text-primary">{ws.name}</span>
              <span className={`type-body-s font-medium ${colorClass}`}>
                {ws.executionCount} {ws.executionCount === 1 ? "run" : "runs"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
