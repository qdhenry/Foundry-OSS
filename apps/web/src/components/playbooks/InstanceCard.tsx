"use client";

import { useState } from "react";

type InstanceStatus = "active" | "completed" | "cancelled";

const STATUS_BADGE: Record<InstanceStatus, string> = {
  active: "bg-status-info-bg text-accent-default",
  completed: "bg-status-success-bg text-status-success-fg",
  cancelled: "bg-surface-elevated text-text-secondary",
};

const STATUS_LABEL: Record<InstanceStatus, string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface InstanceCardProps {
  instance: {
    _id: string;
    name: string;
    status: InstanceStatus;
    startedAt: number;
    completedAt?: number;
    totalTasks: number;
    doneTasks: number;
    taskSummaries: { _id: string; title: string; status: string }[];
  };
}

const TASK_STATUS_DOT: Record<string, string> = {
  backlog: "bg-surface-elevated",
  todo: "bg-status-info-fg",
  in_progress: "bg-status-warning-fg",
  review: "bg-status-success-fg",
  done: "bg-status-success-fg",
};

export function InstanceCard({ instance }: InstanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progressPercent =
    instance.totalTasks > 0 ? Math.round((instance.doneTasks / instance.totalTasks) * 100) : 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-text-heading truncate">{instance.name}</h4>
          <p className="mt-0.5 text-xs text-text-muted">
            Started{" "}
            {new Date(instance.startedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[instance.status]}`}
        >
          {STATUS_LABEL[instance.status]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-text-secondary">
            {instance.doneTasks}/{instance.totalTasks} tasks done
          </span>
          <span className="font-medium text-text-primary">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-accent-default transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Expand/collapse task list */}
      {instance.taskSummaries.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-accent-default hover:text-accent-strong"
        >
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? "Hide tasks" : "Show tasks"}
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {instance.taskSummaries.map((task) => (
            <div
              key={task._id}
              className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-1.5"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${TASK_STATUS_DOT[task.status] ?? "bg-slate-300"}`}
              />
              <span className="truncate text-xs text-text-primary">{task.title}</span>
              <span className="ml-auto shrink-0 text-[10px] text-text-muted">
                {task.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
