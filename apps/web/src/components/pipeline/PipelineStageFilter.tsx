"use client";

import {
  PIPELINE_STAGE_CONFIG,
  PIPELINE_STAGES,
  type PipelineStage,
} from "../../../convex/shared/pipelineStage";

interface PipelineStageFilterProps {
  activeStage: PipelineStage | null;
  activePriority: string | null;
  searchQuery: string;
  onStageChange: (stage: PipelineStage | null) => void;
  onPriorityChange: (priority: string | null) => void;
  onSearchChange: (query: string) => void;
}

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "must_have", label: "Must Have" },
  { value: "should_have", label: "Should Have" },
  { value: "nice_to_have", label: "Nice to Have" },
  { value: "deferred", label: "Deferred" },
];

export function PipelineStageFilter({
  activeStage,
  activePriority,
  searchQuery,
  onStageChange,
  onPriorityChange,
  onSearchChange,
}: PipelineStageFilterProps) {
  const hasActiveFilters =
    activeStage !== null || activePriority !== null || searchQuery.length > 0;

  function handleClearAll() {
    onStageChange(null);
    onPriorityChange(null);
    onSearchChange("");
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Stage Filter */}
      <select
        value={activeStage ?? ""}
        onChange={(e) =>
          onStageChange(e.target.value === "" ? null : (e.target.value as PipelineStage))
        }
        className="select"
      >
        <option value="">All Stages</option>
        {PIPELINE_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {PIPELINE_STAGE_CONFIG[stage].label}
          </option>
        ))}
      </select>

      {/* Priority Filter */}
      <select
        value={activePriority ?? ""}
        onChange={(e) => onPriorityChange(e.target.value === "" ? null : e.target.value)}
        className="select"
      >
        <option value="">All Priorities</option>
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Search Input */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search requirements..."
          className="input pl-8 w-56"
        />
      </div>

      {/* Clear All Filters */}
      {hasActiveFilters && (
        <button
          onClick={handleClearAll}
          className="h-9 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover hover:text-text-primary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
