// packages/ui/src/activity/CoverageDetail.tsx
"use client";

import { useMemo } from "react";
import type { EnrichedExecution, RequirementSummary } from "./utils";

interface CoverageDetailProps {
  executions: EnrichedExecution[];
  requirements: RequirementSummary[];
  workstreamNames: Map<string, string>;
  onBack: () => void;
}

interface CoverageEntry {
  refId: string;
  title: string;
  executionCount: number;
  hasCoverage: boolean;
}

interface WorkstreamCoverage {
  name: string;
  entries: CoverageEntry[];
  coveredCount: number;
  totalCount: number;
}

export function CoverageDetail({
  executions,
  requirements,
  workstreamNames,
  onBack,
}: CoverageDetailProps) {
  const coverage = useMemo(() => {
    // Count executions per requirement
    const execCountByReq = new Map<string, number>();
    for (const exec of executions) {
      if (exec.requirementId) {
        execCountByReq.set(exec.requirementId, (execCountByReq.get(exec.requirementId) ?? 0) + 1);
      }
    }

    // Group requirements by workstream
    const byWorkstream = new Map<string, CoverageEntry[]>();
    for (const req of requirements) {
      const wsKey = req.workstreamId ?? "unassigned";
      const entries = byWorkstream.get(wsKey) ?? [];
      entries.push({
        refId: req.refId,
        title: req.title,
        executionCount: execCountByReq.get(req._id) ?? 0,
        hasCoverage: execCountByReq.has(req._id),
      });
      byWorkstream.set(wsKey, entries);
    }

    // Build sorted coverage list
    const result: WorkstreamCoverage[] = [];
    for (const [wsId, entries] of byWorkstream) {
      const name = workstreamNames.get(wsId) ?? "Unassigned";
      const covered = entries.filter((e) => e.hasCoverage).length;
      // Sort: uncovered first, then by refId
      entries.sort((a, b) => {
        if (a.hasCoverage !== b.hasCoverage) return a.hasCoverage ? 1 : -1;
        return a.refId.localeCompare(b.refId);
      });
      result.push({ name, entries, coveredCount: covered, totalCount: entries.length });
    }

    result.sort((a, b) => {
      const aRatio = a.totalCount > 0 ? a.coveredCount / a.totalCount : 0;
      const bRatio = b.totalCount > 0 ? b.coveredCount / b.totalCount : 0;
      return aRatio - bRatio; // Least covered first
    });

    return result;
  }, [executions, requirements, workstreamNames]);

  const totalCovered = coverage.reduce((s, w) => s + w.coveredCount, 0);
  const totalReqs = coverage.reduce((s, w) => s + w.totalCount, 0);

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-accent-default transition-colors hover:text-accent-hover"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to Dashboard
        <span className="ml-1 text-text-muted">· Requirement Coverage</span>
      </button>

      <p className="type-caption normal-case tracking-normal text-text-muted">
        {totalCovered}/{totalReqs} requirements have agent activity
      </p>

      {coverage.map((ws) => (
        <div key={ws.name} className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h3 className="type-body-s font-semibold text-text-heading">{ws.name}</h3>
            <span className="type-caption normal-case tracking-normal text-text-muted">
              {ws.coveredCount}/{ws.totalCount} covered
            </span>
          </div>
          <div className="divide-y divide-border-default">
            {ws.entries.map((entry) => (
              <div key={entry.refId} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="type-body-s text-text-primary">
                    <span className="font-medium text-accent-default">{entry.refId}</span>
                    <span className="ml-1.5 text-text-secondary">{entry.title}</span>
                  </p>
                </div>
                <div className="ml-4 shrink-0">
                  {entry.hasCoverage ? (
                    <span className="flex items-center gap-1 text-xs text-status-success-fg">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      {entry.executionCount} {entry.executionCount === 1 ? "run" : "runs"}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">No activity</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
