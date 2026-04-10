"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { PipelineEmptyState } from "./PipelineEmptyState";
import { PipelineRequirementCard } from "./PipelineRequirementCard";
import { PipelineStageFilter } from "./PipelineStageFilter";
import { PipelineStageSummary } from "./PipelineStageSummary";
import type { PipelineStage } from "./pipelineStage";
import { RequirementPipelinePanel } from "./RequirementPipelinePanel";

interface WorkstreamPipelineTabProps {
  programId: string;
  workstreamId: string;
  onCreateRequirement: () => void;
}

export function WorkstreamPipelineTab({
  programId,
  workstreamId,
  onCreateRequirement,
}: WorkstreamPipelineTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filter state
  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [activePriority, setActivePriority] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Panel state from URL
  const selectedReqId = searchParams.get("req");
  const highlightReqId = searchParams.get("highlight");
  const referrer = searchParams.get("from") ?? undefined;

  // Queries
  const stageCounts = useQuery("requirements:pipelineStageCounts" as any, {
    programId,
    workstreamId,
  });

  const requirements = useQuery("requirements:listWithPipelineContext" as any, {
    programId,
    workstreamId,
    ...(activeStage ? { stage: activeStage } : {}),
    ...(activePriority ? { priority: activePriority as any } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
  });

  const openRequirementPanel = useCallback(
    (reqId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("req", reqId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const closeRequirementPanel = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("req");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const handleStageClick = useCallback((stage: PipelineStage | null) => {
    setActiveStage(stage);
  }, []);

  // Empty state
  if (stageCounts && stageCounts.total === 0) {
    return <PipelineEmptyState programId={programId} onCreateRequirement={onCreateRequirement} />;
  }

  return (
    <div className="space-y-4">
      {/* Stage summary bar */}
      {stageCounts && (
        <PipelineStageSummary
          counts={stageCounts.counts}
          activeStage={activeStage}
          onStageClick={handleStageClick}
          total={stageCounts.total}
        />
      )}

      {/* Filter toolbar */}
      <PipelineStageFilter
        activeStage={activeStage}
        activePriority={activePriority}
        searchQuery={searchQuery}
        onStageChange={setActiveStage}
        onPriorityChange={setActivePriority}
        onSearchChange={setSearchQuery}
      />

      {/* Requirement cards */}
      {requirements === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-raised" />
          ))}
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface-default p-8 text-center">
          <p className="text-sm text-text-secondary">No requirements match the current filters.</p>
          <button
            onClick={() => {
              setActiveStage(null);
              setActivePriority(null);
              setSearchQuery("");
            }}
            className="mt-2 text-sm font-medium text-accent-default"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {requirements.map((req: any) => (
            <PipelineRequirementCard
              key={req._id}
              requirement={req}
              onClick={() => openRequirementPanel(req._id)}
              isHighlighted={req._id === highlightReqId}
            />
          ))}
        </div>
      )}

      {/* Requirement stepper panel (slide-over) */}
      {selectedReqId && (
        <RequirementPipelinePanel
          requirementId={selectedReqId}
          programId={programId}
          workstreamId={workstreamId}
          onClose={closeRequirementPanel}
          referrer={referrer}
        />
      )}
    </div>
  );
}
