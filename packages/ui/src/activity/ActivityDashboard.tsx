// packages/ui/src/activity/ActivityDashboard.tsx
"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "./MetricCard";
import type { EnrichedExecution, TraceContext } from "./utils";
import {
  computeMetrics,
  estimateCost,
  formatTokens,
  getMetricColor,
  humanizeTaskType,
  timeAgo,
} from "./utils";
import { WorkstreamGrid } from "./WorkstreamGrid";

interface ActivityDashboardProps {
  executions: EnrichedExecution[];
  totalRequirements: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDrillDown: (context: TraceContext) => void;
  onCoverageDrillDown: () => void;
}

export function ActivityDashboard({
  executions,
  totalRequirements,
  searchQuery,
  onSearchChange,
  onDrillDown,
  onCoverageDrillDown,
}: ActivityDashboardProps) {
  const metrics = useMemo(
    () => computeMetrics(executions, totalRequirements),
    [executions, totalRequirements],
  );

  const recentExecutions = useMemo(() => executions.slice(0, 5), [executions]);

  const handleAcceptanceClick = useCallback(() => {
    onDrillDown({
      filter: "rejected-revised",
      label: "Rejected & revised executions",
      filterFn: (e) => e.reviewStatus === "rejected" || e.reviewStatus === "revised",
    });
  }, [onDrillDown]);

  const handleVelocityClick = useCallback(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    onDrillDown({
      filter: "this-week",
      label: "This week's executions",
      filterFn: (e) => e._creationTime >= oneWeekAgo,
    });
  }, [onDrillDown]);

  const handleSpendClick = useCallback(() => {
    onDrillDown({
      filter: "by-spend",
      label: "Executions by token spend",
      filterFn: () => true,
    });
  }, [onDrillDown]);

  const handleWorkstreamDrillDown = useCallback(
    (workstreamId: string, workstreamName: string) => {
      onDrillDown({
        filter: `workstream-${workstreamId}`,
        label: `${workstreamName} workstream`,
        filterFn: (e) => e.workstreamId === workstreamId,
      });
    },
    [onDrillDown],
  );

  const handleRecentClick = useCallback(
    (exec: EnrichedExecution) => {
      const reqId = exec.requirementId;
      onDrillDown({
        filter: reqId ? `req-${reqId}` : `exec-${exec._id}`,
        label: exec.requirementTitle ?? exec.taskTitle ?? humanizeTaskType(exec.taskType),
        filterFn: reqId ? (e) => e.requirementId === reqId : (e) => e._id === exec._id,
      });
    },
    [onDrillDown],
  );

  const velocityDeltaText =
    metrics.velocityDelta > 0
      ? `+${metrics.velocityDelta} from last week`
      : metrics.velocityDelta < 0
        ? `${metrics.velocityDelta} from last week`
        : "Same as last week";

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search requirements, tasks, workstreams..."
          className="input w-full pl-10 indent-4"
        />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Acceptance Rate"
          value={`${Math.round(metrics.acceptanceRate)}%`}
          subtitle={`${metrics.acceptedCount}/${metrics.reviewedCount} reviewed`}
          colorClass={getMetricColor(metrics.acceptanceRate, { green: 90, yellow: 70 })}
          onClick={handleAcceptanceClick}
        />
        <MetricCard
          label="This Week"
          value={String(metrics.velocityThisWeek)}
          subtitle={velocityDeltaText}
          colorClass="text-accent-default"
          onClick={handleVelocityClick}
        />
        <MetricCard
          label="Token Spend"
          value={formatTokens(metrics.totalTokens)}
          subtitle={estimateCost(metrics.totalTokens)}
          colorClass="text-status-warning-fg"
          onClick={handleSpendClick}
        />
        <MetricCard
          label="Coverage"
          value={`${Math.round(metrics.coveragePercent)}%`}
          subtitle={`${metrics.coveredCount}/${metrics.totalRequirements} requirements`}
          colorClass={getMetricColor(metrics.coveragePercent, { green: 80, yellow: 50 })}
          onClick={onCoverageDrillDown}
        />
      </div>

      {/* Workstream grid */}
      <WorkstreamGrid executions={executions} onDrillDown={handleWorkstreamDrillDown} />

      {/* Recent activity */}
      {recentExecutions.length > 0 && (
        <div>
          <h2 className="type-body-s mb-3 font-semibold text-text-heading">Recent Activity</h2>
          <div className="card divide-y divide-border-default overflow-hidden">
            {recentExecutions.map((exec) => {
              const isRejected = exec.reviewStatus === "rejected";
              const isRevised = exec.reviewStatus === "revised";
              return (
                <button
                  key={exec._id}
                  onClick={() => handleRecentClick(exec)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-interactive-hover"
                >
                  <span className="text-sm text-text-primary">
                    {humanizeTaskType(exec.taskType)}
                    {exec.requirementRefId && (
                      <span className="ml-1.5 text-accent-default">— {exec.requirementRefId}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{timeAgo(exec._creationTime)}</span>
                    <span
                      className={`text-xs font-medium ${
                        isRejected || isRevised
                          ? "text-status-error-fg"
                          : exec.reviewStatus === "accepted"
                            ? "text-status-success-fg"
                            : "text-status-warning-fg"
                      }`}
                    >
                      {exec.reviewStatus === "accepted"
                        ? "OK"
                        : exec.reviewStatus === "pending"
                          ? "Pending"
                          : isRevised
                            ? "Revised"
                            : "Failed"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
