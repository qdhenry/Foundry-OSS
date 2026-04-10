"use client";

import { useCallback, useEffect, useState } from "react";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import { PipelineMetroMap } from "./PipelineMetroMap";
import { PipelineSummaryBar } from "./PipelineSummaryBar";
import { MOCK_REQUIREMENTS, MOCK_WORKSTREAMS, PIPELINE_STAGES } from "./pipeline-mock-data";
import type { PipelineStage } from "./pipeline-types";
import { usePipelineKeyboard } from "./use-pipeline-keyboard";
import { WorkstreamFilterTabs } from "./WorkstreamFilterTabs";

export interface PipelineLabPageProps {
  programId: string;
  programSlug: string;
}

export function PipelineLabPage(_props: PipelineLabPageProps) {
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [activeWorkstreamFilter, setActiveWorkstreamFilter] = useState<string | null>(null);
  const [focusedStage, setFocusedStage] = useState<PipelineStage | null>(null);

  const filteredRequirements = activeWorkstreamFilter
    ? MOCK_REQUIREMENTS.filter((r) => r.workstreamId === activeWorkstreamFilter)
    : MOCK_REQUIREMENTS;

  const selectedRequirement = selectedRequirementId
    ? (MOCK_REQUIREMENTS.find((r) => r.id === selectedRequirementId) ?? null)
    : null;

  const handleClosePanel = useCallback(() => {
    setSelectedRequirementId(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedRequirementId) {
        handleClosePanel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRequirementId, handleClosePanel]);

  usePipelineKeyboard({
    requirements: filteredRequirements,
    stages: PIPELINE_STAGES,
    selectedId: selectedRequirementId,
    onSelect: setSelectedRequirementId,
    onOpen: setSelectedRequirementId,
    onClose: handleClosePanel,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="type-display-m text-text-heading">Pipeline Lab</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track requirements through the migration pipeline from discovery to deployment
        </p>
      </div>

      <div className="px-6 pb-4">
        <WorkstreamFilterTabs
          workstreams={MOCK_WORKSTREAMS}
          activeFilter={activeWorkstreamFilter}
          onFilterChange={setActiveWorkstreamFilter}
        />
      </div>

      <div className="flex-1 overflow-x-auto px-6">
        <PipelineMetroMap
          requirements={filteredRequirements}
          stages={PIPELINE_STAGES}
          workstreams={MOCK_WORKSTREAMS}
          selectedId={selectedRequirementId}
          activeWorkstreamFilter={activeWorkstreamFilter}
          highlightedStage={focusedStage}
          onSelectRequirement={setSelectedRequirementId}
          onHoverRequirement={() => {}}
          onHighlightStage={setFocusedStage}
        />
      </div>

      <div className="flex items-center gap-4 px-6 pb-3 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-text-muted" />
          On Track
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-status-warning-fg animate-pulse" />
          At Risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full ring-2 ring-status-error-fg bg-transparent" />
          Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="h-3 w-3 text-status-success-fg" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Deployed
        </span>
      </div>

      <PipelineSummaryBar requirements={filteredRequirements} stages={PIPELINE_STAGES} />

      {selectedRequirement && (
        <PipelineDetailPanel
          requirement={selectedRequirement}
          stages={PIPELINE_STAGES}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
