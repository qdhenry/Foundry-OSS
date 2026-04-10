"use client";

import React from "react";
import {
  PIPELINE_STAGE_CONFIG,
  PIPELINE_STAGES,
  type PipelineStage,
} from "../../../convex/shared/pipelineStage";

interface PipelineStageSummaryProps {
  counts: Record<PipelineStage, number>;
  activeStage: PipelineStage | null;
  onStageClick: (stage: PipelineStage | null) => void;
  total: number;
}

export function PipelineStageSummary({
  counts,
  activeStage,
  onStageClick,
  total,
}: PipelineStageSummaryProps) {
  function handleClick(stage: PipelineStage) {
    if (activeStage === stage) {
      onStageClick(null);
    } else {
      onStageClick(stage);
    }
  }

  return (
    <div className="w-full">
      {/* Total summary line */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Pipeline Overview</h3>
        <span className="text-sm text-text-secondary">
          {total} requirement{total !== 1 ? "s" : ""} total
        </span>
      </div>

      {/* Stage pills row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PIPELINE_STAGES.map((stage, index) => {
          const config = PIPELINE_STAGE_CONFIG[stage];
          const count = counts[stage] ?? 0;
          const isActive = activeStage === stage;
          const hasItems = count > 0;

          return (
            <React.Fragment key={stage}>
              {/* Arrow connector (skip before first pill) */}
              {index > 0 && (
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-border-default"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 2.5L9.5 7L5 11.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              {/* Stage pill */}
              <button
                type="button"
                onClick={() => handleClick(stage)}
                title={`${config.label}: ${count} requirement${count !== 1 ? "s" : ""}`}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                  "text-xs font-medium transition-colors duration-150",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  "cursor-pointer select-none",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : hasItems
                      ? "bg-surface-raised text-text-primary hover:bg-interactive-subtle hover:text-accent-default"
                      : "bg-surface-raised text-text-muted hover:bg-surface-elevated hover:text-text-secondary",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="whitespace-nowrap">{config.shortLabel}</span>
                <span
                  className={[
                    "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                    isActive
                      ? "bg-blue-500 text-white"
                      : hasItems
                        ? "bg-surface-elevated text-text-primary"
                        : "bg-surface-raised text-text-muted",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {activeStage && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            Filtered:{" "}
            <span className="font-medium text-blue-600">
              {PIPELINE_STAGE_CONFIG[activeStage].label}
            </span>{" "}
            ({counts[activeStage] ?? 0})
          </span>
          <button
            type="button"
            onClick={() => onStageClick(null)}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M3 3L9 9M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
