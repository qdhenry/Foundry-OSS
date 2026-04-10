"use client";

import type { PipelineStageConfig } from "./pipeline-types";

type StationHeaderProps = {
  stage: PipelineStageConfig;
  count: number;
  isHighlighted: boolean;
  onClick: () => void;
};

export function StationHeader({ stage, count, isHighlighted, onClick }: StationHeaderProps) {
  const isBottleneck = count >= 4;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-1 py-2"
    >
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
          "bg-surface-raised text-text-primary border-border-default",
          isHighlighted && "ring-2 ring-blue-500",
          isBottleneck && "ring-2 ring-amber-400 motion-safe:animate-pulse",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {stage.shortLabel}
      </div>

      <span className="text-[11px] font-medium text-text-secondary leading-tight text-center hidden lg:block">
        {stage.label}
      </span>
      <span className="text-[11px] font-medium text-text-secondary leading-tight text-center lg:hidden">
        {stage.shortLabel}
      </span>

      <span
        className={[
          "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium min-w-[1.25rem]",
          count > 0 ? "bg-status-info-bg text-accent-default" : "bg-surface-raised text-text-muted",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
