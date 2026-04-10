"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Calendar, Clock, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface SprintCapacityPlannerProps {
  sprintId: Id<"sprints">;
  programId: Id<"programs">;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

export function SprintCapacityPlanner({ sprintId, programId }: SprintCapacityPlannerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- large schema causes deep type instantiation
  const data = useQuery(api.sprintPlanning.getRecommendation as any, { sprintId });
  const planSprint = useMutation(api.sprintPlanning.requestSprintPlan);

  const [planning, setPlanning] = useState(false);

  async function handlePlanSprint() {
    setPlanning(true);
    try {
      await planSprint({ sprintId });
    } finally {
      setPlanning(false);
    }
  }

  // Loading
  if (data === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading sprint plan...</p>
        </div>
      </div>
    );
  }

  // No recommendation yet
  if (!data) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex flex-col items-center py-6">
          <Calendar size={32} className="mb-3 text-accent-default" />
          <p className="text-sm font-medium text-text-heading">No sprint plan available</p>
          <p className="mt-1 text-xs text-text-muted">
            Generate an AI-powered capacity plan for this sprint.
          </p>
          <button
            onClick={handlePlanSprint}
            disabled={planning}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {planning ? "Planning..." : "Plan Sprint"}
          </button>
        </div>
      </div>
    );
  }

  const recommendation = data.recommendation as {
    capacity_analysis?: {
      total_hours: number;
      estimated_points: number;
      team_allocation?: Array<{
        role: string;
        name?: string;
        available_hours: number;
        allocated_points: number;
      }>;
    };
    recommended_tasks?: Array<{
      requirement_title: string;
      story_points: number;
      priority: string;
      rationale: string;
    }>;
    deferred_items?: Array<{
      title: string;
      reason: string;
    }>;
    sprint_health?: {
      velocity_confidence: number;
      dependency_risks: string[];
      skill_gaps: string[];
    };
    total_planned_points?: number;
    capacity_utilization?: number;
  };

  const capacity = recommendation.capacity_analysis;
  const recommended = recommendation.recommended_tasks ?? [];
  const deferred = recommendation.deferred_items ?? [];
  const health = recommendation.sprint_health;
  const utilization = recommendation.capacity_utilization ?? 0;

  return (
    <div className="space-y-4">
      {/* Capacity Analysis */}
      {capacity && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <Users size={16} className="text-accent-default" />
            Capacity Analysis
          </h4>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-raised p-3">
              <p className="text-xs text-text-secondary">Total Hours</p>
              <p className="text-lg font-bold text-text-heading">{capacity.total_hours}h</p>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <p className="text-xs text-text-secondary">Estimated Points</p>
              <p className="text-lg font-bold text-text-heading">{capacity.estimated_points}</p>
            </div>
          </div>

          {/* Team allocation table */}
          {capacity.team_allocation && capacity.team_allocation.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border-default">
              <table className="w-full text-xs">
                <thead className="bg-surface-raised">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">Role</th>
                    <th className="px-3 py-2 text-right font-medium text-text-secondary">Hours</th>
                    <th className="px-3 py-2 text-right font-medium text-text-secondary">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {capacity.team_allocation.map((member, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-text-primary">{member.name ?? member.role}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        {member.available_hours}h
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        {member.allocated_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recommended Tasks */}
      {recommended.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <TrendingUp size={16} className="text-status-success-fg" />
            Recommended Tasks ({recommended.length})
          </h4>
          <div className="space-y-2">
            {recommended.map((task, i) => (
              <div key={i} className="rounded-lg border border-border-default p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-text-heading">{task.requirement_title}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                      {task.story_points} SP
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary">{task.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deferred Items */}
      {deferred.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <Clock size={16} className="text-text-muted" />
            Deferred Items ({deferred.length})
          </h4>
          <div className="space-y-2">
            {deferred.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-border-default bg-surface-raised p-2.5"
              >
                <p className="text-xs font-medium text-text-primary">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-text-secondary">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sprint Health */}
      {health && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <AlertTriangle size={16} className="text-status-warning-fg" />
            Sprint Health
          </h4>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-text-secondary">Velocity Confidence</span>
                <span className="font-semibold text-text-heading">
                  {Math.round(health.velocity_confidence * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`h-full rounded-full transition-all ${
                    health.velocity_confidence >= 0.8
                      ? "bg-status-success-fg"
                      : health.velocity_confidence >= 0.5
                        ? "bg-status-warning-fg"
                        : "bg-status-error-fg"
                  }`}
                  style={{
                    width: `${Math.round(health.velocity_confidence * 100)}%`,
                  }}
                />
              </div>
            </div>

            {health.dependency_risks.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">Dependency Risks</p>
                <ul className="space-y-1">
                  {health.dependency_risks.map((risk, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[11px] text-status-warning-fg"
                    >
                      <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-status-warning-fg" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {health.skill_gaps.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">Skill Gaps</p>
                <ul className="space-y-1">
                  {health.skill_gaps.map((gap, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[11px] text-status-error-fg"
                    >
                      <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-status-error-fg" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary footer */}
      <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-default px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            <span className="font-semibold text-text-heading">
              {recommendation.total_planned_points ?? 0}
            </span>{" "}
            planned points
          </span>
          <span>
            <span
              className={`font-semibold ${
                utilization > 90
                  ? "text-status-error-fg"
                  : utilization > 75
                    ? "text-status-warning-fg"
                    : "text-status-success-fg"
              }`}
            >
              {Math.round(utilization)}%
            </span>{" "}
            capacity utilization
          </span>
        </div>
        <button
          onClick={handlePlanSprint}
          disabled={planning}
          className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {planning ? "Planning..." : "Plan Sprint"}
        </button>
      </div>
    </div>
  );
}
