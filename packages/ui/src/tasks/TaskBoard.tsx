"use client";

import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { useStaggerEntrance } from "../theme/useAnimations";
import { TaskCard } from "./TaskCard";

type Status = "backlog" | "todo" | "in_progress" | "review" | "done";

const COLUMNS: { status: Status; label: string; color: string }[] = [
  {
    status: "backlog",
    label: "Backlog",
    color: "border-t-slate-400",
  },
  {
    status: "todo",
    label: "To Do",
    color: "border-t-blue-500",
  },
  {
    status: "in_progress",
    label: "In Progress",
    color: "border-t-amber-500",
  },
  {
    status: "review",
    label: "Review",
    color: "border-t-emerald-500",
  },
  {
    status: "done",
    label: "Done",
    color: "border-t-green-500",
  },
];

export interface TaskBoardProps {
  tasks: {
    _id: string;
    title: string;
    description?: string;
    priority: "critical" | "high" | "medium" | "low";
    status: Status;
    assigneeName?: string;
    sprintId?: string;
    sprintName?: string;
    workstreamShortCode?: string;
    dueDate?: number;
    hasSubtasks?: boolean;
    subtaskCount?: number;
    subtasksCompleted?: number;
    subtasksFailed?: number;
    lastSubtaskActivity?: string;
    repoFullName?: string;
  }[];
  programId: string;
  programSlug: string;
  sprints?: { _id: string; name: string }[];
}

export function TaskBoard({ tasks, programId, programSlug, sprints }: TaskBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(boardRef, ".animate-card");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignSprintId, setAssignSprintId] = useState("");

  const bulkAssignToSprint = useMutation("tasks:bulkAssignToSprint" as any);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkAssignSprint = useCallback(async () => {
    if (!assignSprintId || selectedIds.size === 0) return;
    await bulkAssignToSprint({
      taskIds: Array.from(selectedIds),
      sprintId: assignSprintId,
    });
    setSelectedIds(new Set());
    setAssignSprintId("");
  }, [assignSprintId, selectedIds, bulkAssignToSprint]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setAssignSprintId("");
  }, []);

  const tasksByStatus = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.status),
  }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            selectMode
              ? "bg-accent-default text-text-on-brand"
              : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
          }`}
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
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {selectMode ? "Cancel Select" : "Select"}
        </button>

        {/* Bulk action bar */}
        {selectMode && selectedIds.size > 0 && (
          <>
            <div className="h-4 w-px bg-border-default" />
            <span className="text-sm font-medium text-text-primary">
              {selectedIds.size} selected
            </span>

            {sprints && sprints.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={assignSprintId}
                  onChange={(e) => setAssignSprintId(e.target.value)}
                  className="select text-sm"
                >
                  <option value="">Assign to Sprint...</option>
                  {sprints.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssignSprint}
                  disabled={!assignSprintId}
                  className="btn-primary btn-sm disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Board columns */}
      <div
        ref={boardRef}
        className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4 lg:grid-cols-5 lg:grid-flow-row lg:overflow-x-visible"
      >
        {tasksByStatus.map((col) => (
          <div key={col.status} className="min-w-[240px]">
            <div
              className={`mb-3 rounded-lg border border-border-default border-t-4 bg-surface-default px-3 py-2 ${col.color}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">{col.label}</h3>
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
                  {col.tasks.length}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {col.tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default px-3 py-6 text-center">
                  <p className="text-xs text-text-muted">No tasks</p>
                </div>
              ) : (
                col.tasks.map((task) => (
                  <div key={task._id} className="animate-card">
                    {selectMode ? (
                      <div
                        onClickCapture={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleSelect(task._id);
                        }}
                        className={`cursor-pointer rounded-lg border-2 transition-colors ${
                          selectedIds.has(task._id) ? "border-accent-default" : "border-transparent"
                        }`}
                      >
                        <div className="relative">
                          {selectedIds.has(task._id) && (
                            <div className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent-default text-white">
                              <svg
                                className="h-3 w-3"
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
                            </div>
                          )}
                          <TaskCard
                            task={task}
                            programId={programId}
                            programSlug={programSlug}
                            compact
                          />
                        </div>
                      </div>
                    ) : (
                      <TaskCard
                        task={task}
                        programId={programId}
                        programSlug={programSlug}
                        compact
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
