"use client";

import type { Effort, FitGap, MockRequirement, Priority } from "./pipeline-types";

type RequirementTooltipProps = {
  requirement: MockRequirement;
  visible: boolean;
};

const PRIORITY_BADGE: Record<Priority, string> = {
  must_have: "bg-status-error-bg text-status-error-fg",
  should_have: "bg-status-warning-bg text-status-warning-fg",
  nice_to_have: "bg-surface-raised text-text-secondary",
  deferred: "bg-surface-raised text-text-muted",
};

const FIT_GAP_BADGE: Record<FitGap, string> = {
  native: "bg-status-success-bg text-status-success-fg",
  config: "bg-status-info-bg text-accent-default",
  custom_dev: "bg-status-warning-bg text-status-warning-fg",
  third_party: "bg-surface-raised text-text-secondary",
  not_feasible: "bg-status-error-bg text-status-error-fg",
};

const EFFORT_BADGE: Record<Effort, string> = {
  low: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-info-bg text-accent-default",
  high: "bg-status-warning-bg text-status-warning-fg",
  very_high: "bg-status-error-bg text-status-error-fg",
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RequirementTooltip({ requirement, visible }: RequirementTooltipProps) {
  if (!visible) return null;

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 max-w-xs w-72 rounded-lg bg-surface-default shadow-lg border border-border-default p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-primary">
          {requirement.refId}
        </span>
        <span className="text-sm font-medium text-text-heading truncate">{requirement.title}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[requirement.priority]}`}
        >
          {formatLabel(requirement.priority)}
        </span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${FIT_GAP_BADGE[requirement.fitGap]}`}
        >
          {formatLabel(requirement.fitGap)}
        </span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${EFFORT_BADGE[requirement.effort]}`}
        >
          {formatLabel(requirement.effort)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
        <span>{formatLabel(requirement.currentStage)}</span>
        <span className="text-text-muted">&middot;</span>
        <span>{requirement.daysInStage}d in stage</span>
      </div>

      {requirement.aiRecommendation && (
        <p className="mt-2 text-xs text-accent-default italic leading-snug">
          {requirement.aiRecommendation}
        </p>
      )}
    </div>
  );
}
