"use client";

import { PipelineStepper } from "./PipelineStepper";
import type { MockRequirement, PipelineStageConfig } from "./pipeline-types";

interface PipelineDetailPanelProps {
  requirement: MockRequirement;
  stages: PipelineStageConfig[];
  onClose: () => void;
}

const PRIORITY_LABEL: Record<string, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const PRIORITY_BADGE: Record<string, string> = {
  must_have: "bg-status-error-bg text-status-error-fg",
  should_have: "bg-status-warning-bg text-status-warning-fg",
  nice_to_have: "bg-surface-raised text-text-secondary",
  deferred: "bg-surface-raised text-text-muted",
};

const FITGAP_LABEL: Record<string, string> = {
  native: "Native",
  config: "Config",
  custom_dev: "Custom Dev",
  third_party: "Third Party",
  not_feasible: "Not Feasible",
};

const FITGAP_BADGE: Record<string, string> = {
  native: "bg-status-success-bg text-status-success-fg",
  config: "bg-status-info-bg text-accent-default",
  custom_dev: "bg-status-warning-bg text-status-warning-fg",
  third_party: "bg-surface-raised text-text-secondary",
  not_feasible: "bg-status-error-bg text-status-error-fg",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
};

const EFFORT_BADGE: Record<string, string> = {
  low: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-info-bg text-accent-default",
  high: "bg-status-warning-bg text-status-warning-fg",
  very_high: "bg-status-error-bg text-status-error-fg",
};

const HEALTH_LABEL: Record<string, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  blocked: "Blocked",
};

const HEALTH_BADGE: Record<string, string> = {
  on_track: "bg-status-success-bg text-status-success-fg",
  at_risk: "bg-status-warning-bg text-status-warning-fg",
  blocked: "bg-status-error-bg text-status-error-fg",
};

export function PipelineDetailPanel({ requirement, stages, onClose }: PipelineDetailPanelProps) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const currentStageConfig = sorted.find((s) => s.id === requirement.currentStage);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-40 flex h-full w-[480px] flex-col border-l border-border-default bg-surface-default shadow-xl"
        style={{ animation: "slideInRight 200ms ease-out" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default p-4">
          <div className="flex-1">
            <span className="mb-1 inline-block rounded bg-surface-raised px-2 py-0.5 font-mono text-sm text-text-secondary">
              {requirement.refId}
            </span>
            <h2 className="mt-1 text-lg font-semibold text-text-heading">{requirement.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Pipeline Stepper */}
          <div className="mb-6">
            <label className="mb-3 block text-xs font-medium text-text-secondary">
              Pipeline Progress
            </label>
            <PipelineStepper currentStage={requirement.currentStage} stages={stages} />
          </div>

          {/* Stage Detail */}
          <div className="mb-6 rounded-lg border border-border-default bg-surface-raised p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-text-secondary">Current Stage</span>
                <p className="font-medium text-text-heading">
                  {currentStageConfig?.label ?? requirement.currentStage}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-text-secondary">Days in Stage</span>
                <p
                  className={`font-medium ${requirement.daysInStage > 5 ? "text-status-warning-fg" : "text-text-heading"}`}
                >
                  {requirement.daysInStage}d
                </p>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Priority</label>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_BADGE[requirement.priority]}`}
              >
                {PRIORITY_LABEL[requirement.priority]}
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Fit/Gap</label>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${FITGAP_BADGE[requirement.fitGap]}`}
              >
                {FITGAP_LABEL[requirement.fitGap]}
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Effort</label>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${EFFORT_BADGE[requirement.effort]}`}
              >
                {EFFORT_LABEL[requirement.effort]}
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Health</label>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${HEALTH_BADGE[requirement.health]}`}
              >
                {HEALTH_LABEL[requirement.health]}
              </span>
            </div>
          </div>

          {/* AI Recommendation */}
          {requirement.aiRecommendation && (
            <div className="mb-6">
              <label className="mb-2 block text-xs font-medium text-text-secondary">
                AI Recommendation
              </label>
              <div className="rounded-lg border border-status-info-border bg-status-info-bg p-3">
                <div className="flex gap-2">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <p className="text-sm text-accent-default">{requirement.aiRecommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stage History */}
          <div>
            <label className="mb-3 block text-xs font-medium text-text-secondary">
              Stage History
            </label>
            <div className="space-y-0">
              {requirement.stageHistory.map((entry, i) => {
                const stageConfig = sorted.find((s) => s.id === entry.stage);
                const isLast = i === requirement.stageHistory.length - 1;

                return (
                  <div key={entry.stage} className="flex gap-3">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          isLast ? "bg-blue-500" : "bg-border-default"
                        }`}
                      />
                      {!isLast && <div className="w-px flex-1 bg-border-default" />}
                    </div>

                    {/* Content */}
                    <div className={`pb-4 ${isLast ? "" : ""}`}>
                      <p className="text-sm font-medium text-text-heading">
                        {stageConfig?.label ?? entry.stage}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {entry.enteredAt}
                        {entry.exitedAt ? ` — ${entry.exitedAt}` : " — present"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
