"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface ReadinessMatrixProps {
  programId: Id<"programs">;
}

type Quadrant =
  | "READY"
  | "IN_PROGRESS"
  | "SPECIFIED"
  | "DEFINED"
  | "RISKY"
  | "REVIEW"
  | "BACKLOG"
  | "DANGER"
  | "ROGUE";

const QUADRANT_CONFIG: Record<Quadrant, { label: string; bg: string; text: string; dot: string }> =
  {
    READY: {
      label: "Ready",
      bg: "bg-status-success-bg",
      text: "text-status-success-fg",
      dot: "bg-status-success-fg",
    },
    IN_PROGRESS: {
      label: "In Progress",
      bg: "bg-status-info-bg",
      text: "text-status-info-fg",
      dot: "bg-blue-500",
    },
    SPECIFIED: {
      label: "Specified",
      bg: "bg-status-warning-bg",
      text: "text-status-warning-fg",
      dot: "bg-status-warning-fg",
    },
    DEFINED: {
      label: "Defined",
      bg: "bg-surface-elevated",
      text: "text-text-secondary",
      dot: "bg-slate-400",
    },
    RISKY: {
      label: "Risky",
      bg: "bg-status-warning-bg",
      text: "text-status-warning-fg",
      dot: "bg-status-warning-fg",
    },
    REVIEW: {
      label: "Review",
      bg: "bg-status-warning-bg",
      text: "text-status-warning-fg",
      dot: "bg-status-warning-fg",
    },
    BACKLOG: {
      label: "Backlog",
      bg: "bg-surface-raised",
      text: "text-text-secondary",
      dot: "bg-slate-300",
    },
    DANGER: {
      label: "Danger",
      bg: "bg-status-error-bg",
      text: "text-status-error-fg",
      dot: "bg-status-error-fg",
    },
    ROGUE: {
      label: "Rogue",
      bg: "bg-status-error-bg",
      text: "text-status-error-fg",
      dot: "bg-status-error-fg",
    },
  };

interface MatrixEntry {
  requirementId: string;
  refId: string;
  title: string;
  scopeCompleteness: number;
  implementationCompleteness: number;
  quadrant: string;
  color: string;
  description: string;
  isWarning: boolean;
}

// Grid layout: rows are scope (top=high), columns are implementation (left=low)
const GRID: Quadrant[][] = [
  ["SPECIFIED", "IN_PROGRESS", "READY"], // top row: scope high (67-100)
  ["DEFINED", "RISKY", "REVIEW"], // middle row: scope mid (34-66)
  ["BACKLOG", "DANGER", "ROGUE"], // bottom row: scope low (0-33)
];

export function ReadinessMatrix({ programId }: ReadinessMatrixProps) {
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  const matrixData = useQuery(api.sourceControl.completeness.readinessMatrix.getForProgram, {
    programId,
  });

  if (matrixData === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading readiness matrix...</p>
      </div>
    );
  }

  if (!matrixData || matrixData.entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-default px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
          <svg
            className="h-6 w-6 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-primary">
          Connect repositories to see implementation readiness across your requirements.
        </p>
      </div>
    );
  }

  // Group entries by quadrant
  const entriesByQuadrant: Record<Quadrant, MatrixEntry[]> = {
    READY: [],
    IN_PROGRESS: [],
    SPECIFIED: [],
    DEFINED: [],
    RISKY: [],
    REVIEW: [],
    BACKLOG: [],
    DANGER: [],
    ROGUE: [],
  };
  for (const entry of matrixData.entries) {
    entriesByQuadrant[entry.quadrant as Quadrant].push(entry as MatrixEntry);
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-primary">
          {matrixData.totalRequirements} requirement{matrixData.totalRequirements !== 1 ? "s" : ""}
        </span>
        {matrixData.warningCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-error-bg px-2.5 py-0.5 text-xs font-medium text-status-error-fg">
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            {matrixData.warningCount} warning{matrixData.warningCount !== 1 ? "s" : ""}
          </span>
        )}
        {/* Quadrant summary chips */}
        {(Object.entries(matrixData.summary) as [Quadrant, number][]).map(([q, count]) => {
          if (count === 0) return null;
          const config = QUADRANT_CONFIG[q];
          return (
            <span
              key={q}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
            >
              {config.label} {count}
            </span>
          );
        })}
      </div>

      {/* Matrix grid */}
      <div className="flex gap-4">
        {/* Y-axis label */}
        <div className="flex w-6 shrink-0 items-center justify-center">
          <span className="origin-center -rotate-90 whitespace-nowrap text-xs font-medium text-text-secondary">
            Scope Completeness
          </span>
        </div>

        <div className="flex-1 space-y-1">
          {/* Y-axis range labels */}
          <div className="grid grid-cols-[auto_1fr] gap-1">
            <div className="w-12" />
            <div className="grid grid-cols-3 gap-1">
              {GRID.map((row, rowIdx) => (
                <div key={rowIdx} className="contents">
                  {row.map((quadrant) => {
                    const config = QUADRANT_CONFIG[quadrant];
                    const entries = entriesByQuadrant[quadrant];

                    return (
                      <div
                        key={quadrant}
                        className={`relative min-h-[100px] rounded-lg border border-border-default p-2 ${config.bg}`}
                      >
                        {/* Quadrant label */}
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${config.text}`}
                        >
                          {config.label}
                        </span>

                        {/* Requirement dots */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entries.map((entry) => (
                            <div
                              key={entry.requirementId}
                              className="group relative"
                              onMouseEnter={() => setHoveredEntry(entry.requirementId)}
                              onMouseLeave={() => setHoveredEntry(null)}
                            >
                              <div
                                className={`h-3 w-3 cursor-pointer rounded-full ${config.dot} ring-1 ring-white/50 transition-transform hover:scale-150`}
                                title={`${entry.refId}: ${entry.title}`}
                              />
                              {hoveredEntry === entry.requirementId && (
                                <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg">
                                  <span className="font-semibold">{entry.refId}</span>:{" "}
                                  {entry.title}
                                  <div className="mt-0.5 text-[10px] text-slate-300">
                                    Scope: {entry.scopeCompleteness}% | Impl:{" "}
                                    {entry.implementationCompleteness}%
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Count badge */}
                        {entries.length > 0 && (
                          <span
                            className={`absolute bottom-1 right-1 text-[10px] font-medium ${config.text} opacity-60`}
                          >
                            {entries.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Row labels (scope ranges) */}
          <div className="grid grid-cols-[auto_1fr] gap-1">
            <div className="w-12" />
            <div className="grid grid-cols-3 gap-1">
              <span className="text-center text-[10px] text-text-muted">Low (0-33)</span>
              <span className="text-center text-[10px] text-text-muted">Mid (34-66)</span>
              <span className="text-center text-[10px] text-text-muted">High (67-100)</span>
            </div>
          </div>

          {/* X-axis label */}
          <div className="text-center">
            <span className="text-xs font-medium text-text-secondary">
              Implementation Completeness
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
