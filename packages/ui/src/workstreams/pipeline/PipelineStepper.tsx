"use client";

import { useState } from "react";
import {
  PIPELINE_STAGE_CONFIG,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGES,
  type PipelineStage,
} from "./pipelineStage";

interface PipelineStepperProps {
  currentStage: PipelineStage;
  onStageClick?: (stage: PipelineStage) => void;
}

export function PipelineStepper({ currentStage, onStageClick }: PipelineStepperProps) {
  const [expanded, setExpanded] = useState(false);
  const currentOrder = PIPELINE_STAGE_ORDER[currentStage];

  // On narrow screens, show current +/- 1 unless expanded
  const visibleStages = PIPELINE_STAGES.map((stage) => {
    const order = PIPELINE_STAGE_ORDER[stage];
    const isNearCurrent = Math.abs(order - currentOrder) <= 1;
    return { stage, isNearCurrent };
  });

  return (
    <div className="w-full">
      {/* Desktop: always show all 8 stages */}
      <div className="hidden md:flex md:items-start">
        {PIPELINE_STAGES.map((stage, i) => {
          const config = PIPELINE_STAGE_CONFIG[stage];
          const order = PIPELINE_STAGE_ORDER[stage];
          const isCompleted = order < currentOrder;
          const isCurrent = stage === currentStage;

          return (
            <div key={stage} className="flex items-start" style={{ flex: 1 }}>
              <button
                onClick={() => onStageClick?.(stage)}
                className="flex flex-col items-center focus:outline-none"
                title={config.label}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "border-blue-500 bg-blue-500 text-white"
                      : isCurrent
                        ? "border-blue-500 bg-interactive-subtle text-accent-default"
                        : "border-border-default bg-surface-default text-text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-medium">{order + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-1.5 text-center text-[10px] leading-tight ${
                    isCompleted || isCurrent ? "font-medium text-text-primary" : "text-text-muted"
                  }`}
                  style={{ maxWidth: 64 }}
                >
                  {config.shortLabel}
                </span>
              </button>

              {/* Connecting line */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="mt-4 flex flex-1 items-center px-1">
                  <div
                    className={`h-0.5 w-full ${
                      order < currentOrder
                        ? "bg-blue-500"
                        : "border-t border-dashed border-border-default"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: collapsed view (current +/- 1) */}
      <div className="md:hidden">
        {!expanded ? (
          <div>
            <div className="flex items-start justify-center">
              {visibleStages
                .filter((v) => v.isNearCurrent)
                .map(({ stage }, i, arr) => {
                  const config = PIPELINE_STAGE_CONFIG[stage];
                  const order = PIPELINE_STAGE_ORDER[stage];
                  const isCompleted = order < currentOrder;
                  const isCurrent = stage === currentStage;

                  return (
                    <div key={stage} className="flex items-start" style={{ flex: 1 }}>
                      <button
                        onClick={() => onStageClick?.(stage)}
                        className="flex flex-col items-center focus:outline-none"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            isCompleted
                              ? "border-blue-500 bg-blue-500 text-white"
                              : isCurrent
                                ? "border-blue-500 bg-interactive-subtle text-accent-default"
                                : "border-border-default bg-surface-default text-text-muted"
                          }`}
                        >
                          {isCompleted ? (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <span className="text-xs font-medium">{order + 1}</span>
                          )}
                        </div>
                        <span className="mt-1 text-center text-[10px] font-medium text-text-primary">
                          {config.shortLabel}
                        </span>
                      </button>
                      {i < arr.length - 1 && (
                        <div className="mt-4 flex flex-1 items-center px-2">
                          <div
                            className={`h-0.5 w-full ${
                              order < currentOrder
                                ? "bg-blue-500"
                                : "border-t border-dashed border-border-default"
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 block w-full text-center text-xs text-accent-default"
            >
              Show all stages ({currentOrder + 1}/8)
            </button>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-center gap-1">
              {PIPELINE_STAGES.map((stage, _i) => {
                const config = PIPELINE_STAGE_CONFIG[stage];
                const order = PIPELINE_STAGE_ORDER[stage];
                const isCompleted = order < currentOrder;
                const isCurrent = stage === currentStage;

                return (
                  <button
                    key={stage}
                    onClick={() => {
                      onStageClick?.(stage);
                      setExpanded(false);
                    }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      isCompleted
                        ? "bg-status-info-bg text-accent-default"
                        : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-surface-elevated text-text-secondary"
                    }`}
                  >
                    {isCompleted && (
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {config.shortLabel}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="mt-2 block w-full text-center text-xs text-accent-default"
            >
              Collapse
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
