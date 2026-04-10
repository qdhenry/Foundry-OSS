"use client";

import { useMemo } from "react";
import type {
  MockRequirement,
  MockWorkstream,
  PipelineStage,
  PipelineStageConfig,
} from "./pipeline-types";
import { StationHeader } from "./StationHeader";
import { WorkstreamLine } from "./WorkstreamLine";

type PipelineMetroMapProps = {
  requirements: MockRequirement[];
  workstreams: MockWorkstream[];
  stages: PipelineStageConfig[];
  selectedId: string | null;
  activeWorkstreamFilter: string | null;
  highlightedStage: PipelineStage | null;
  onSelectRequirement: (id: string) => void;
  onHoverRequirement: (id: string | null) => void;
  onHighlightStage: (stage: PipelineStage | null) => void;
};

export function PipelineMetroMap({
  requirements,
  workstreams,
  stages,
  selectedId,
  activeWorkstreamFilter,
  highlightedStage,
  onSelectRequirement,
  onHoverRequirement,
  onHighlightStage,
}: PipelineMetroMapProps) {
  // Count requirements per stage for StationHeader
  const stageCounts = useMemo(() => {
    const counts = new Map<PipelineStage, number>();
    for (const stage of stages) {
      counts.set(stage.id, 0);
    }
    for (const req of requirements) {
      counts.set(req.currentStage, (counts.get(req.currentStage) ?? 0) + 1);
    }
    return counts;
  }, [requirements, stages]);

  // Group requirements by workstream
  const reqsByWorkstream = useMemo(() => {
    const map = new Map<string, MockRequirement[]>();
    for (const req of requirements) {
      const list = map.get(req.workstreamId) ?? [];
      list.push(req);
      map.set(req.workstreamId, list);
    }
    return map;
  }, [requirements]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header row: empty gutter + station headers */}
        <div className="grid grid-cols-[11rem_repeat(8,1fr)]">
          <div />
          {stages.map((stage) => (
            <StationHeader
              key={stage.id}
              stage={stage}
              count={stageCounts.get(stage.id) ?? 0}
              isHighlighted={highlightedStage === stage.id}
              onClick={() => onHighlightStage(highlightedStage === stage.id ? null : stage.id)}
            />
          ))}
        </div>

        {/* Workstream rows */}
        <div className="mt-2 space-y-3">
          {workstreams.map((ws) => {
            const wsReqs = reqsByWorkstream.get(ws.id) ?? [];
            const isDimmed = activeWorkstreamFilter !== null && activeWorkstreamFilter !== ws.id;

            return (
              <WorkstreamLine
                key={ws.id}
                workstream={ws}
                requirements={wsReqs}
                stages={stages}
                selectedId={selectedId}
                dimmed={isDimmed}
                onSelectRequirement={onSelectRequirement}
                onHoverRequirement={onHoverRequirement}
                highlightedStage={highlightedStage}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
