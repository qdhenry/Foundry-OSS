"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProgramContext } from "@/lib/programContext";
import type { Id } from "../../../../convex/_generated/dataModel";
import { type NextStep, StageNextSteps } from "./StageNextSteps";

const TASK_STATUS_BADGE: Record<string, string> = {
  backlog: "bg-surface-elevated text-text-secondary",
  todo: "bg-status-info-bg text-accent-default",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  review: "bg-status-success-bg text-status-success-fg",
  done: "bg-status-success-bg text-status-success-fg",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

interface PipelineStageImplementationProps {
  requirement: {
    _id: string;
    refId: string;
    title: string;
  };
  programId: Id<"programs">;
  workstreamId: Id<"workstreams">;
  tasks: Array<{
    _id: string;
    title: string;
    status: string;
    priority: string;
    assigneeName?: string;
  }>;
}

export function PipelineStageImplementation({
  programId,
  tasks,
}: PipelineStageImplementationProps) {
  const { slug } = useProgramContext();
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const inReview = tasks.filter((t) => t.status === "review");
  const done = tasks.filter((t) => t.status === "done");
  const remaining = tasks.filter(
    (t) => t.status !== "in_progress" && t.status !== "review" && t.status !== "done",
  );

  const completedCount = done.length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const implNextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    if (inProgress.length > 0) {
      steps.push({
        label: `${remaining.length + inProgress.length} task${remaining.length + inProgress.length !== 1 ? "s" : ""} remaining — focus on in-progress tasks`,
        description: inProgress.map((t) => t.title).join(", "),
      });
    } else if (remaining.length > 0) {
      steps.push({
        label: `${remaining.length} task${remaining.length !== 1 ? "s" : ""} in backlog — start working on the next task`,
        description: "Pick up the next task to keep implementation moving forward.",
      });
    }
    if (inReview.length > 0) {
      steps.push({
        label: `${inReview.length} task${inReview.length !== 1 ? "s" : ""} in review`,
        description: "Review and approve completed tasks to advance toward testing.",
      });
    }
    return steps;
  }, [inProgress, inReview, remaining]);

  return (
    <div className="space-y-4">
      {/* Progress overview */}
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Implementation Progress</h3>

        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            {completedCount} of {totalCount} tasks complete
          </span>
          <span className="font-medium text-text-heading">{progressPercent}%</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Status summary */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-status-warning-bg p-2 text-center">
            <p className="text-lg font-bold text-status-warning-fg">{inProgress.length}</p>
            <p className="text-[10px] text-status-warning-fg">In Progress</p>
          </div>
          <div className="rounded-lg bg-status-success-bg p-2 text-center">
            <p className="text-lg font-bold text-status-success-fg">{inReview.length}</p>
            <p className="text-[10px] text-status-success-fg">In Review</p>
          </div>
          <div className="rounded-lg bg-status-success-bg p-2 text-center">
            <p className="text-lg font-bold text-status-success-fg">{done.length}</p>
            <p className="text-[10px] text-status-success-fg">Done</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-2 text-center">
            <p className="text-lg font-bold text-text-primary">{remaining.length}</p>
            <p className="text-[10px] text-text-secondary">Remaining</p>
          </div>
        </div>
      </div>

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-heading">Tasks</h3>
          <div className="space-y-2">
            {tasks.map((task) => (
              <Link
                key={task._id}
                href={`/${slug}/tasks/${task._id}`}
                className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2 transition-colors hover:bg-interactive-hover"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-heading">{task.title}</p>
                  {task.assigneeName && (
                    <p className="text-xs text-text-secondary">{task.assigneeName}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_BADGE[task.status] ?? ""}`}
                >
                  {TASK_STATUS_LABEL[task.status] ?? task.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <StageNextSteps steps={implNextSteps} />
    </div>
  );
}
