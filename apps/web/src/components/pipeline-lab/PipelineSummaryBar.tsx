"use client";

import type { MockRequirement, PipelineStageConfig } from "./pipeline-types";

interface PipelineSummaryBarProps {
  requirements: MockRequirement[];
  stages: PipelineStageConfig[];
}

const STAGE_COLORS: Record<string, string> = {
  discovery: "bg-slate-400",
  gap_analysis: "bg-blue-400",
  solution_design: "bg-brand-400",
  sprint_planning: "bg-status-warning-fg",
  implementation: "bg-emerald-400",
  testing: "bg-teal-400",
  uat: "bg-sky-400",
  deployed: "bg-emerald-600",
};

export function PipelineSummaryBar({ requirements, stages }: PipelineSummaryBarProps) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const total = requirements.length;

  // Count per stage
  const stageCounts = sorted.map((stage) => ({
    ...stage,
    count: requirements.filter((r) => r.currentStage === stage.id).length,
  }));

  // Completion %
  const deployedCount = requirements.filter((r) => r.currentStage === "deployed").length;
  const completionPct = total > 0 ? Math.round((deployedCount / total) * 100) : 0;

  // Blocked count
  const blockedCount = requirements.filter((r) => r.health === "blocked").length;

  return (
    <div className="sticky bottom-0 z-20 border-t border-border-default bg-surface-default px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Stacked segment bar */}
        <div className="flex-1">
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-raised">
            {stageCounts.map((stage) => {
              if (stage.count === 0) return null;
              const widthPct = (stage.count / total) * 100;
              return (
                <div
                  key={stage.id}
                  className={`${STAGE_COLORS[stage.id]} transition-all`}
                  style={{ width: `${widthPct}%` }}
                  title={`${stage.label}: ${stage.count}`}
                />
              );
            })}
          </div>
        </div>

        {/* Per-stage count pills */}
        <div className="flex items-center gap-1.5">
          {stageCounts.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5"
              title={stage.label}
            >
              <div className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage.id]}`} />
              <span className="text-xs font-medium text-text-secondary">{stage.count}</span>
            </div>
          ))}
        </div>

        {/* Completion % */}
        <div className="flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1">
          <span className="text-xs font-semibold text-status-success-fg">{completionPct}%</span>
          <span className="text-xs text-status-success-fg">deployed</span>
        </div>

        {/* Blocked warning */}
        {blockedCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-status-error-bg px-3 py-1">
            <svg
              className="h-3.5 w-3.5 text-status-error-fg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-xs font-semibold text-status-error-fg">
              {blockedCount} blocked
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
