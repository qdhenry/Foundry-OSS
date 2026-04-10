"use client";

import type { PipelineStage, PipelineStageConfig } from "./pipeline-types";

interface PipelineStepperProps {
  currentStage: PipelineStage;
  stages: PipelineStageConfig[];
}

export function PipelineStepper({ currentStage, stages }: PipelineStepperProps) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const currentOrder = sorted.find((s) => s.id === currentStage)?.order ?? 0;

  return (
    <div className="flex items-start">
      {sorted.map((stage, i) => {
        const isCompleted = stage.order < currentOrder;
        const isCurrent = stage.id === currentStage;
        const isFuture = stage.order > currentOrder;

        return (
          <div key={stage.id} className="flex items-start" style={{ flex: 1 }}>
            {/* Circle + label column */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "border-blue-500 bg-blue-500 text-white"
                    : isCurrent
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-border-default bg-surface-default"
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
                  <span
                    className={`text-xs font-medium ${
                      isCurrent ? "text-white" : "text-text-muted"
                    }`}
                  >
                    {stage.order + 1}
                  </span>
                )}
              </div>
              <span
                className={`mt-1.5 text-center text-[10px] leading-tight ${
                  isCompleted || isCurrent ? "font-medium text-text-primary" : "text-text-muted"
                }`}
                style={{ maxWidth: 64 }}
              >
                {stage.shortLabel}
              </span>
            </div>

            {/* Connecting line */}
            {i < sorted.length - 1 && (
              <div className="mt-3.5 flex flex-1 items-center px-1">
                <div
                  className={`h-0.5 w-full ${
                    isFuture ? "border-t border-dashed border-border-default" : "bg-blue-500"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
