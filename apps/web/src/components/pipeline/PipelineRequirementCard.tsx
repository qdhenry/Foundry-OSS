"use client";

import { useEffect, useRef, useState } from "react";
import {
  PIPELINE_STAGE_CONFIG,
  PIPELINE_STAGE_ORDER,
  type PipelineStage,
} from "../../../convex/shared/pipelineStage";

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
  const stageProgressPercent = ((stageOrder + 1) / TOTAL_STAGES) * 100;

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
      className={`cursor-pointer rounded-xl border bg-surface-default p-4 transition-all hover:border-blue-300 hover:bg-surface-raised hover:shadow-md ${
        showHighlight ? "ring-2 ring-blue-500 border-blue-300" : "border-border-default"
      }`}
    >
      {/* Top section: refId + title on left, badges on right */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: refId + title */}
        <div className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[11px] font-medium tracking-wide text-text-muted">
            {requirement.refId}
          </span>
          <h3 className="text-sm font-semibold leading-snug text-text-heading line-clamp-2">
            {requirement.title}
          </h3>
        </div>

        {/* Right: badges */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
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
      </div>

      {/* Middle row: sprint + task count */}
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        {requirement.sprintName && (
          <span className="flex items-center gap-1">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {requirement.sprintName}
          </span>
        )}
        {requirement.taskCount > 0 && (
          <span className="flex items-center gap-1">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            {requirement.tasksCompleted}/{requirement.taskCount} tasks
          </span>
        )}
      </div>

      {/* Stage-aware action badges */}
      {stage === "requirement" && (
        <div className="mt-2.5">
          <span className="inline-flex items-center rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-medium text-status-warning-fg">
            Needs Approval
          </span>
        </div>
      )}
      {stage === "task_generation" && requirement.taskCount === 0 && (
        <div className="mt-2.5">
          <span className="inline-flex items-center rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-medium text-accent-default">
            Generate Tasks
          </span>
        </div>
      )}

      {/* Pipeline stage indicator */}
      <div className="mt-3 border-t border-border-default pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-primary">
            {stageConfig?.label ?? stage}
          </span>
          <span className="text-[10px] text-text-muted">
            Stage {stageOrder + 1} of {TOTAL_STAGES}
          </span>
        </div>

        {/* Mini progress bar */}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${stageProgressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
