"use client";

import Link from "next/link";
import { useProgramContext } from "../../programs";

interface PipelineEmptyStateProps {
  programId: string;
  onCreateRequirement: () => void;
}

const PIPELINE_STAGES = [
  "Discovery",
  "Requirement",
  "Sprint",
  "Tasks",
  "Subtasks",
  "Implementation",
  "Testing",
  "Review",
] as const;

export function PipelineEmptyState({ programId, onCreateRequirement }: PipelineEmptyStateProps) {
  const { slug } = useProgramContext();
  return (
    <div className="rounded-xl border border-dashed border-border-subtle bg-surface-default px-6 py-12 text-center">
      {/* Pipeline illustration */}
      <div className="mx-auto mb-8 max-w-2xl overflow-x-auto">
        <svg
          viewBox="0 0 720 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto w-full"
          aria-label="Pipeline stages: Discovery through Review"
          role="img"
        >
          {PIPELINE_STAGES.map((stage, index) => {
            const cx = 45 + index * 90;
            const cy = 28;
            const radius = 16;

            return (
              <g key={stage}>
                {/* Connector line to next stage */}
                {index < PIPELINE_STAGES.length - 1 && (
                  <line
                    x1={cx + radius + 2}
                    y1={cy}
                    x2={cx + 90 - radius - 2}
                    y2={cy}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    className="stroke-border-default"
                  />
                )}
                {/* Stage circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  strokeWidth={1.5}
                  className={
                    index === 0
                      ? "fill-accent-default stroke-accent-strong"
                      : "fill-surface-raised stroke-border-default"
                  }
                />
                {/* Stage number */}
                <text
                  x={cx}
                  y={cy + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                  className={index === 0 ? "fill-white" : "fill-text-muted"}
                >
                  {index + 1}
                </text>
                {/* Stage label */}
                <text
                  x={cx}
                  y={cy + radius + 16}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-text-muted"
                >
                  {stage}
                </text>
              </g>
            );
          })}
          {/* Arrow indicators between stages */}
          {PIPELINE_STAGES.slice(0, -1).map((_, index) => {
            const arrowX = 45 + index * 90 + 45;
            const arrowY = 28;
            return (
              <polygon
                key={`arrow-${index}`}
                points={`${arrowX - 3},${arrowY - 3} ${arrowX + 3},${arrowY} ${arrowX - 3},${arrowY + 3}`}
                className="fill-border-default"
              />
            );
          })}
        </svg>
      </div>

      {/* Heading */}
      <h3 className="text-lg font-semibold text-text-heading">No Requirements in This Pipeline</h3>

      {/* Explanation */}
      <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">
        This pipeline tracks each requirement from initial discovery through final review.
        Requirements flow through 8 stages as your team works on them.
      </p>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/${slug}/discovery?section=documents`}
          className="rounded-lg border border-status-info-border bg-status-info-bg px-4 py-2 text-sm font-medium text-accent-default transition-colors hover:bg-interactive-subtle"
        >
          Upload a Document in Discovery Hub
        </Link>
        <button
          onClick={onCreateRequirement}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Create a Requirement Manually
        </button>
      </div>
    </div>
  );
}
