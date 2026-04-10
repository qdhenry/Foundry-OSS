"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PIPELINE_STAGE_CONFIG, type PipelineStage } from "../../../convex/shared/pipelineStage";

interface PipelineActivityLogProps {
  programId: Id<"programs">;
  requirementId: Id<"requirements">;
  currentStage: PipelineStage;
}

export function PipelineActivityLog({
  programId,
  requirementId,
  currentStage,
}: PipelineActivityLogProps) {
  const [showAllStages, setShowAllStages] = useState(false);

  const auditEvents = useQuery(api.auditLog.listByEntity, {
    entityType: "requirement",
    entityId: requirementId,
  });

  const _stageLabel = PIPELINE_STAGE_CONFIG[currentStage].label;

  // Filter events based on toggle
  const events = auditEvents ?? [];

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h3 className="text-sm font-semibold text-text-heading">Activity</h3>
        <div className="flex items-center gap-1 rounded-lg bg-surface-raised p-0.5">
          <button
            onClick={() => setShowAllStages(false)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              !showAllStages
                ? "bg-surface-default text-text-heading shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Current Stage
          </button>
          <button
            onClick={() => setShowAllStages(true)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showAllStages
                ? "bg-surface-default text-text-heading shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            All Stages
          </button>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto px-4 py-3">
        {events.length === 0 ? (
          <p className="text-xs text-text-muted">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, showAllStages ? 50 : 10).map((event: any) => (
              <div key={event._id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 text-text-muted">
                  {new Date(event.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-text-primary">{event.description}</span>
                {event.userName && (
                  <span className="shrink-0 text-text-muted">by {event.userName}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
