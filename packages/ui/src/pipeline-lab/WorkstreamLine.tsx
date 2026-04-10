"use client";

import { useState } from "react";
import type {
  MockRequirement,
  MockWorkstream,
  PipelineStage,
  PipelineStageConfig,
} from "./pipeline-types";
import { RequirementDot } from "./RequirementDot";
import { RequirementTooltip } from "./RequirementTooltip";

type WorkstreamLineProps = {
  workstream: MockWorkstream;
  requirements: MockRequirement[];
  stages: PipelineStageConfig[];
  selectedId: string | null;
  dimmed: boolean;
  onSelectRequirement: (id: string) => void;
  onHoverRequirement: (id: string | null) => void;
  highlightedStage: PipelineStage | null;
};

export function WorkstreamLine({
  workstream,
  requirements,
  stages,
  selectedId,
  dimmed,
  onSelectRequirement,
  onHoverRequirement,
  highlightedStage,
}: WorkstreamLineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Group requirements by stage for stacking
  const byStage = new Map<PipelineStage, MockRequirement[]>();
  for (const req of requirements) {
    const list = byStage.get(req.currentStage) ?? [];
    list.push(req);
    byStage.set(req.currentStage, list);
  }

  const hoveredReq = hoveredId ? (requirements.find((r) => r.id === hoveredId) ?? null) : null;

  return (
    <div className="grid grid-cols-[11rem_repeat(8,1fr)] items-center">
      {/* Left gutter */}
      <div className="flex items-center gap-2 pr-2">
        <span
          className="h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: workstream.color }}
        />
        <span className="text-xs font-medium text-text-primary truncate">{workstream.name}</span>
        <span className="ml-auto rounded bg-surface-elevated px-1 py-0.5 text-[10px] font-mono text-text-secondary flex-shrink-0">
          {workstream.shortCode}
        </span>
      </div>

      {/* Stage columns */}
      {stages.map((stage) => {
        const stageReqs = byStage.get(stage.id) ?? [];
        const isActiveColumn = highlightedStage === stage.id;

        return (
          <div
            key={stage.id}
            className="relative flex items-center justify-center min-h-[4.5rem] px-1"
          >
            {/* Track line */}
            <div
              className={[
                "absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full",
                isActiveColumn ? "opacity-60" : "opacity-25",
              ].join(" ")}
              style={{ backgroundColor: workstream.color }}
            />

            {/* Requirement dots */}
            <div className="relative flex flex-wrap items-center justify-center gap-1">
              {stageReqs.map((req, idx) => (
                <div key={req.id} className="relative">
                  {hoveredId === req.id && hoveredReq && (
                    <RequirementTooltip requirement={hoveredReq} visible={true} />
                  )}
                  <RequirementDot
                    requirement={req}
                    workstreamColor={workstream.color}
                    isSelected={selectedId === req.id}
                    isDimmed={dimmed}
                    stackIndex={idx}
                    onClick={() => onSelectRequirement(req.id)}
                    onHover={(hovering) => {
                      const id = hovering ? req.id : null;
                      setHoveredId(id);
                      onHoverRequirement(id);
                    }}
                    dotId={`dot-${req.id}`}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
