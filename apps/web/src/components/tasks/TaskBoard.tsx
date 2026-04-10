"use client";

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

interface TaskBoardProps {
  tasks: {
    _id: string;
    title: string;
    description?: string;
    priority: "critical" | "high" | "medium" | "low";
    status: Status;
    assigneeName?: string;
    sprintName?: string;
    workstreamShortCode?: string;
    dueDate?: number;
    hasSubtasks?: boolean;
    subtaskCount?: number;
    subtasksCompleted?: number;
    subtasksFailed?: number;
    lastSubtaskActivity?: string;
  }[];
  programId: string;
}

export function TaskBoard({ tasks, programId }: TaskBoardProps) {
  const tasksByStatus = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.status),
  }));

  return (
    <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4 lg:grid-cols-5 lg:grid-flow-row lg:overflow-x-visible">
      {tasksByStatus.map((col) => (
        <div key={col.status} className="min-w-[240px]">
          {/* Column header */}
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

          {/* Cards */}
          <div className="space-y-3">
            {col.tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-default px-3 py-6 text-center">
                <p className="text-xs text-text-muted">No tasks</p>
              </div>
            ) : (
              col.tasks.map((task) => (
                <TaskCard key={task._id} task={task} programId={programId} compact />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
