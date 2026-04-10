"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RepoBadge } from "../source-control/RepoBadge";
import { useProgressBar } from "../theme/useAnimations";

type Priority = "critical" | "high" | "medium" | "low";
type Status = "backlog" | "todo" | "in_progress" | "review" | "done";

const PRIORITY_BADGE: Record<Priority, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_BADGE: Record<Status, string> = {
  backlog: "bg-surface-raised text-text-secondary",
  todo: "bg-status-info-bg text-accent-default",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  review: "bg-status-success-bg text-status-success-fg",
  done: "bg-status-success-bg text-status-success-fg",
};

const STATUS_LABEL: Record<Status, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export interface TaskCardProps {
  task: {
    _id: string;
    title: string;
    description?: string;
    priority: Priority;
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
    hasDesignSnapshot?: boolean;
    repoFullName?: string;
  };
  programId: string;
  programSlug: string;
  compact?: boolean;
}

export function TaskCard({ task, programSlug, compact }: TaskCardProps) {
  const router = useRouter();
  const updateStatus = useMutation("tasks:updateStatus" as any);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const subtaskBarRef = useRef<HTMLDivElement>(null);
  const subtaskPercent =
    task.hasSubtasks && task.subtaskCount != null && task.subtaskCount > 0
      ? ((task.subtasksCompleted ?? 0) / task.subtaskCount) * 100
      : undefined;
  useProgressBar(subtaskBarRef, subtaskPercent);

  async function handleStatusChange(newStatus: Status) {
    setShowStatusMenu(false);
    if (newStatus === task.status) return;
    await updateStatus({ taskId: task._id as any, status: newStatus });
  }

  const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";

  return (
    <div className="cursor-pointer rounded-xl border border-border-default bg-surface-default p-4 transition-all hover:border-accent-default hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3
          onClick={() => router.push(`/${programSlug}/tasks/${task._id}`)}
          className="text-sm font-semibold text-text-heading line-clamp-2"
        >
          {task.title}
        </h3>
        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusMenu(!showStatusMenu);
            }}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status]}`}
          >
            {STATUS_LABEL[task.status]}
          </button>
          {showStatusMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStatusMenu(false);
                }}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-border-default bg-surface-default py-1 shadow-lg">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(opt.value);
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-interactive-hover ${
                      opt.value === task.status
                        ? "font-semibold text-accent-default"
                        : "text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {!compact && task.description && (
        <p
          onClick={() => router.push(`/${programSlug}/tasks/${task._id}`)}
          className="mb-2 text-xs text-text-secondary line-clamp-2"
        >
          {task.description}
        </p>
      )}

      <div
        className="mb-2 flex items-center gap-2"
        onClick={() => router.push(`/${programSlug}/tasks/${task._id}`)}
      >
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.workstreamShortCode && (
          <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
            {task.workstreamShortCode}
          </span>
        )}
        {task.hasDesignSnapshot && (
          <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-[10px] font-medium text-status-info-fg">
            Design
          </span>
        )}
        {task.repoFullName && <RepoBadge repoFullName={task.repoFullName} />}
      </div>

      {task.hasSubtasks && task.subtaskCount != null && task.subtaskCount > 0 && (
        <div
          className="mb-2 flex items-center gap-2"
          onClick={() => router.push(`/${programSlug}/tasks/${task._id}`)}
        >
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
            <div
              ref={subtaskBarRef}
              className="h-full rounded-full bg-status-success-fg"
              style={{ width: "0%" }}
            />
          </div>
          <span className="shrink-0 text-[10px] text-text-muted">
            {task.subtasksCompleted ?? 0}/{task.subtaskCount}
          </span>
          {(task.subtasksFailed ?? 0) > 0 && (
            <span className="text-[10px] text-status-error-fg">{task.subtasksFailed} failed</span>
          )}
        </div>
      )}

      <div
        className="flex flex-wrap items-center gap-3 text-xs text-text-muted"
        onClick={() => router.push(`/${programSlug}/tasks/${task._id}`)}
      >
        {task.assigneeName && (
          <span className="flex items-center gap-1">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {task.assigneeName}
          </span>
        )}
        {task.sprintName && (
          <span className="flex items-center gap-1">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {task.sprintName}
          </span>
        )}
        {task.dueDate && (
          <span
            className={`flex items-center gap-1 ${isOverdue ? "font-medium text-status-error-fg" : ""}`}
          >
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
