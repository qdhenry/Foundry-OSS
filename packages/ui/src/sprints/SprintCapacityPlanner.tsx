"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, CheckSquare, Clock, Loader2, Plus, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface SprintCapacityPlannerProps {
  sprintId: string;
  programId: string;
  workstreamId?: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

type UnassignedTask = {
  _id: string;
  title: string;
  priority: string;
  status: string;
  requirementTitle?: string;
  requirementRefId?: string;
  workstreamName?: string;
};

export function SprintCapacityPlanner({
  sprintId,
  programId,
  workstreamId,
}: SprintCapacityPlannerProps) {
  const [scope, setScope] = useState<"workstream" | "all">(workstreamId ? "workstream" : "all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const workstreamTasks = useQuery(
    "tasks:listUnassignedByWorkstream" as any,
    workstreamId ? { workstreamId: workstreamId as any, programId: programId as any } : "skip",
  ) as UnassignedTask[] | undefined;

  const allTasks = useQuery(
    "tasks:listUnassignedByProgram" as any,
    scope === "all" || !workstreamId ? { programId: programId as any } : "skip",
  ) as (UnassignedTask & { workstreamName?: string })[] | undefined;

  const assignedCount = useQuery("tasks:countBySprint" as any, { sprintId: sprintId as any }) as
    | number
    | undefined;

  const bulkAssign = useMutation("tasks:bulkAssignToSprint" as any);
  const planSprint = useMutation("sprintPlanning:requestSprintPlan" as any);

  // AI recommendation data (for optional AI assist)
  const aiData = useQuery("sprintPlanning:getRecommendation" as any, { sprintId: sprintId as any });
  const isAiProcessing = aiData?.status === "processing" || isAiLoading;
  const [isStuck, setIsStuck] = useState(false);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear isAiLoading when backend status transitions away from "processing"
  useEffect(() => {
    if (isAiLoading && aiData?.status !== undefined && aiData?.status !== "processing") {
      setIsAiLoading(false);
    }
  }, [aiData?.status, isAiLoading]);

  // Stuck state detection: warn after 120s of processing
  useEffect(() => {
    if (isAiProcessing) {
      setIsStuck(false);
      stuckTimerRef.current = setTimeout(() => setIsStuck(true), 120_000);
    } else {
      setIsStuck(false);
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
    }
    return () => {
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    };
  }, [isAiProcessing]);

  const tasks = scope === "workstream" && workstreamId ? workstreamTasks : allTasks;
  const isLoading = tasks === undefined;

  const selectedCount = selectedIds.size;
  const allSelected = tasks && tasks.length > 0 && selectedIds.size === tasks.length;

  function toggleTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!tasks) return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t._id)));
    }
  }

  async function handleAssign() {
    if (selectedIds.size === 0) return;
    setIsAssigning(true);
    try {
      await bulkAssign({
        taskIds: Array.from(selectedIds) as any,
        sprintId: sprintId as any,
      });
      setSelectedIds(new Set());
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleAiSuggest() {
    setIsAiLoading(true);
    try {
      await planSprint({ sprintId: sprintId as any });
    } catch {
      setIsAiLoading(false);
    }
  }

  // Extract AI recommended task IDs when available
  const allAiRecommendedIds = useMemo(() => {
    if (!aiData?.recommendation) return new Set<string>();
    const rec = aiData.recommendation as any;
    const ids = new Set<string>();
    if (rec.recommended_existing_tasks) {
      for (const t of rec.recommended_existing_tasks) {
        if (t.task_id) ids.add(t.task_id);
      }
    }
    // Legacy format support
    if (rec.recommended_tasks) {
      for (const t of rec.recommended_tasks) {
        if (t.task_id) ids.add(t.task_id);
      }
    }
    return ids;
  }, [aiData?.recommendation]);

  // Filter to only recommended tasks still in the unassigned list
  const aiRecommendedIds = useMemo(() => {
    if (allAiRecommendedIds.size === 0 || !tasks) return allAiRecommendedIds;
    const taskIdSet = new Set(tasks.map((t) => t._id));
    const visible = new Set<string>();
    for (const id of allAiRecommendedIds) {
      if (taskIdSet.has(id)) visible.add(id);
    }
    return visible;
  }, [allAiRecommendedIds, tasks]);

  const aiRecommendedWereApplied = allAiRecommendedIds.size > 0 && aiRecommendedIds.size === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-heading">
          Sprint Tasks
          {assignedCount !== undefined && assignedCount > 0 && (
            <span className="ml-2 text-xs font-normal text-text-secondary">
              {assignedCount} assigned
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {workstreamId && (
            <div className="flex rounded-lg border border-border-default bg-surface-raised p-0.5">
              <button
                onClick={() => {
                  setScope("workstream");
                  setSelectedIds(new Set());
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  scope === "workstream"
                    ? "bg-surface-default text-text-heading shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Workstream
              </button>
              <button
                onClick={() => {
                  setScope("all");
                  setSelectedIds(new Set());
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  scope === "all"
                    ? "bg-surface-default text-text-heading shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                All Tasks
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Processing Banner */}
      {isAiProcessing && (
        <div className="space-y-2">
          <div className="rounded-lg border border-blue-200 bg-status-info-bg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-accent-default" />
                <p className="text-xs font-medium text-text-heading">
                  {(aiData as any)?.generationProgress ?? "AI is analyzing tasks..."}
                </p>
              </div>
              {aiRecommendedIds.size > 0 && (
                <span className="text-xs text-accent-default">
                  {aiRecommendedIds.size} task{aiRecommendedIds.size !== 1 ? "s" : ""} recommended
                  so far
                </span>
              )}
            </div>
          </div>
          {isStuck && (
            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-status-warning-fg" />
                  <p className="text-xs font-medium text-status-warning-fg">
                    This is taking longer than expected. The AI may be processing a large task set.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAiLoading(false);
                    setIsStuck(false);
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-status-warning-fg transition-colors hover:bg-status-warning-bg"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Error State */}
      {!isAiProcessing && aiData?.status === "error" && (
        <div className="rounded-lg border border-status-error-border bg-status-error-bg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-status-error-fg" />
              <p className="text-xs font-medium text-status-error-fg">
                {(aiData as any)?.error ?? "AI analysis failed. Please try again."}
              </p>
            </div>
            <button
              onClick={handleAiSuggest}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent-default transition-colors hover:bg-interactive-hover"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* AI Suggested Highlight */}
      {aiRecommendedIds.size > 0 &&
        !isAiProcessing &&
        aiData?.status !== "error" &&
        (() => {
          const aiSelectedCount = tasks
            ? tasks.filter((t) => aiRecommendedIds.has(t._id) && selectedIds.has(t._id)).length
            : 0;
          const allAiSelected =
            aiSelectedCount === aiRecommendedIds.size && aiRecommendedIds.size > 0;

          return (
            <div
              className={`rounded-lg border p-3 ${
                allAiSelected
                  ? "border-status-success-border/20 bg-status-success-bg/50"
                  : "border-accent-default/20 bg-accent-default/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {allAiSelected ? (
                    <CheckSquare size={14} className="text-status-success-fg" />
                  ) : (
                    <Sparkles size={14} className="text-accent-default" />
                  )}
                  <p className="text-xs font-medium text-text-heading">
                    {allAiSelected
                      ? `All ${aiRecommendedIds.size} recommended task${aiRecommendedIds.size !== 1 ? "s" : ""} selected`
                      : `AI recommends ${aiRecommendedIds.size} task${aiRecommendedIds.size !== 1 ? "s" : ""}${
                          aiSelectedCount > 0 ? ` (${aiSelectedCount} selected)` : ""
                        }`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!tasks) return;
                    if (allAiSelected) {
                      // Deselect only AI-recommended tasks, keep manually selected ones
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        for (const id of aiRecommendedIds) next.delete(id);
                        return next;
                      });
                    } else {
                      // Select all AI-recommended tasks that exist in current view
                      const matching = tasks
                        .filter((t) => aiRecommendedIds.has(t._id))
                        .map((t) => t._id);
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        for (const id of matching) next.add(id);
                        return next;
                      });
                    }
                  }}
                  className={`text-xs font-medium ${
                    allAiSelected
                      ? "text-status-success-fg hover:text-status-success-fg/80"
                      : "text-accent-default hover:text-accent-strong"
                  }`}
                >
                  {allAiSelected
                    ? "Deselect recommended"
                    : aiSelectedCount > 0
                      ? "Select all recommended"
                      : "Select recommended"}
                </button>
              </div>
            </div>
          );
        })()}

      {/* AI recommendations fully applied */}
      {aiRecommendedWereApplied && !isAiProcessing && aiData?.status !== "error" && (
        <div className="rounded-lg border border-status-success-border/20 bg-status-success-bg/50 p-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-status-success-fg" />
            <p className="text-xs font-medium text-text-heading">
              All {allAiRecommendedIds.size} recommended task
              {allAiRecommendedIds.size !== 1 ? "s" : ""} added to sprint
            </p>
          </div>
        </div>
      )}

      {/* Task Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            <p className="text-sm text-text-secondary">Loading tasks...</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
            <CheckSquare size={20} className="text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-heading">No unassigned tasks</p>
          <p className="mt-1 text-xs text-text-muted">
            {scope === "workstream"
              ? "All workstream tasks are assigned to sprints."
              : "All program tasks are assigned to sprints."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-default">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <button
                    onClick={toggleAll}
                    className="text-text-secondary hover:text-text-heading"
                  >
                    {allSelected ? (
                      <CheckSquare size={16} className="text-accent-default" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">
                  Task
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">
                  Priority
                </th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-text-secondary sm:table-cell">
                  Requirement
                </th>
                {scope === "all" && (
                  <th className="hidden px-3 py-2 text-left text-xs font-medium text-text-secondary md:table-cell">
                    Workstream
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {tasks.map((task) => {
                const isSelected = selectedIds.has(task._id);
                const isRecommended = aiRecommendedIds.has(task._id);
                return (
                  <tr
                    key={task._id}
                    onClick={() => toggleTask(task._id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-accent-default/5"
                        : isRecommended
                          ? "bg-accent-default/[0.02]"
                          : "hover:bg-interactive-hover"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      {isSelected ? (
                        <CheckSquare size={16} className="text-accent-default" />
                      ) : (
                        <Square size={16} className="text-text-muted" />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-heading">{task.title}</span>
                        {isRecommended && (
                          <Sparkles size={12} className="shrink-0 text-accent-default" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      {task.requirementRefId ? (
                        <span className="text-xs text-text-secondary">{task.requirementRefId}</span>
                      ) : (
                        <span className="text-xs text-text-muted">--</span>
                      )}
                    </td>
                    {scope === "all" && (
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <span className="text-xs text-text-secondary">
                          {(task as any).workstreamName ?? "--"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>
            <span className="font-semibold text-text-heading">{selectedCount}</span> task
            {selectedCount !== 1 ? "s" : ""} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiSuggest}
            disabled={isAiProcessing}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent-default transition-colors hover:bg-interactive-hover disabled:opacity-50"
          >
            <Sparkles size={14} />
            {isAiProcessing ? "Analyzing..." : "Ask AI for Suggestions"}
          </button>
          <button
            onClick={handleAssign}
            disabled={selectedCount === 0 || isAssigning}
            className="flex items-center gap-1.5 rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            <Plus size={14} />
            {isAssigning
              ? "Adding..."
              : `Add Selected to Sprint${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
