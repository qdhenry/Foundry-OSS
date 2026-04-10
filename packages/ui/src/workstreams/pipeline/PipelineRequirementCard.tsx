"use client";

import { useEffect, useRef, useState } from "react";
import { ImplementationBadge } from "../../codebase-analysis/ImplementationBadge";
import { PIPELINE_STAGE_CONFIG, PIPELINE_STAGE_ORDER, type PipelineStage } from "./pipelineStage";

// ── Label & Color Maps ────────────────────────────────────────────────

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";

const PRIORITY_LABEL: Record<Priority, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  must_have: "bg-status-error-bg text-status-error-fg",
  should_have: "bg-status-warning-bg text-status-warning-fg",
  nice_to_have: "bg-status-info-bg text-accent-default",
  deferred: "bg-surface-elevated text-text-secondary",
};

const FITGAP_LABEL: Record<FitGap, string> = {
  native: "Native",
  config: "Config",
  custom_dev: "Custom Dev",
  third_party: "3rd Party",
  not_feasible: "Not Feasible",
};

const FITGAP_BADGE: Record<FitGap, string> = {
  native: "bg-status-success-bg text-status-success-fg",
  config: "bg-status-warning-bg text-status-warning-fg",
  custom_dev: "bg-status-success-bg text-status-success-fg",
  third_party: "bg-status-warning-bg text-status-warning-fg",
  not_feasible: "bg-status-error-bg text-status-error-fg",
};

const TOTAL_STAGES = 8;

// ── Props ─────────────────────────────────────────────────────────────

interface PipelineRequirementCardProps {
  requirement: {
    _id: string;
    refId: string;
    title: string;
    priority: string;
    fitGap: string;
    pipelineStage: string;
    sprintName?: string;
    taskCount: number;
    tasksCompleted: number;
    implementationStatus?: string;
    implementationConfidence?: number;
    lastAnalyzedAt?: number;
  };
  onClick: () => void;
  isHighlighted?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────

export function PipelineRequirementCard({
  requirement,
  onClick,
  isHighlighted = false,
}: PipelineRequirementCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showHighlight, setShowHighlight] = useState(isHighlighted);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  const priority = requirement.priority as Priority;
  const fitGap = requirement.fitGap as FitGap;
  const stage = requirement.pipelineStage as PipelineStage;

  const stageConfig = PIPELINE_STAGE_CONFIG[stage];
  const stageOrder = PIPELINE_STAGE_ORDER[stage];
  const _stageProgressPercent = ((stageOrder + 1) / TOTAL_STAGES) * 100;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer rounded-lg border bg-surface-default px-4 py-2.5 transition-all hover:border-blue-300 hover:bg-surface-raised hover:shadow-sm ${
        showHighlight ? "ring-2 ring-blue-500 border-blue-300" : "border-border-default"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* RefId */}
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-text-muted w-16">
          {requirement.refId}
        </span>

        {/* Title */}
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-text-heading">
          {requirement.title}
        </h3>

        {/* Stage badge */}
        <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-text-secondary">
          {stageConfig?.label ?? stage}
        </span>

        {/* Stage-aware action badge */}
        {stage === "requirement" && (
          <span className="shrink-0 rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-medium text-status-warning-fg">
            Needs Approval
          </span>
        )}
        {stage === "task_generation" && requirement.taskCount === 0 && (
          <span className="shrink-0 rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-medium text-accent-default">
            Generate Tasks
          </span>
        )}

        {/* Task count (if any) */}
        {requirement.taskCount > 0 && (
          <span className="shrink-0 text-[11px] text-text-secondary">
            {requirement.tasksCompleted}/{requirement.taskCount}
          </span>
        )}

        {/* Priority + FitGap badges */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.deferred
            }`}
          >
            {PRIORITY_LABEL[priority] ?? priority}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              FITGAP_BADGE[fitGap] ?? FITGAP_BADGE.config
            }`}
          >
            {FITGAP_LABEL[fitGap] ?? fitGap}
          </span>
        </div>

        {/* Implementation analysis badge */}
        <ImplementationBadge
          status={requirement.implementationStatus}
          confidence={requirement.implementationConfidence}
          lastAnalyzedAt={requirement.lastAnalyzedAt}
        />
      </div>
    </div>
  );
}
