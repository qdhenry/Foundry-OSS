"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { TaskDecompositionPanel } from "../TaskDecompositionPanel";
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

interface PipelineStageTaskGenProps {
  requirement: {
    _id: string;
    refId: string;
    title: string;
  };
  programId: string;
  workstreamId: string;
  tasks: Array<{
    _id: string;
    title: string;
    status: string;
    priority: string;
    assigneeName?: string;
  }>;
}

export function PipelineStageTaskGen({ requirement, programId, tasks }: PipelineStageTaskGenProps) {
  const latestDecomp = useQuery("taskDecomposition:getLatestDecomposition" as any, {
    requirementId: requirement._id as string,
  });
  const requestDecomposition = useMutation("taskDecomposition:requestDecomposition" as any);
  const isProcessing = latestDecomp?.status === "processing";
  const hasTasks = tasks.length > 0;

  async function handleRunDecomposition() {
    await requestDecomposition({
      requirementId: requirement._id as string,
    });
  }

  const taskGenNextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    if (isProcessing) {
      steps.push({
        label: "Task decomposition in progress",
        description: "AI is generating tasks — this may take a moment.",
      });
    } else if (latestDecomp?.status === "pending_review") {
      steps.push({
        label: "Review generated tasks",
        description: "Accept or edit the AI-generated tasks above before they become active.",
      });
    } else if (!hasTasks) {
      steps.push({
        label: "Run AI task decomposition",
        description: "Break this requirement into implementation tasks using AI.",
        onClick: handleRunDecomposition,
      });
    }
    return steps;
  }, [isProcessing, latestDecomp?.status, hasTasks]);

  return (
    <div className="space-y-4">
      {/* Task Decomposition Panel — handles generate, accept, reject */}
      <TaskDecompositionPanel requirementId={requirement._id as string} programId={programId} />

      {/* Active tasks list (shown after tasks are accepted) */}
      {hasTasks && (
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-heading">
            Active Tasks ({tasks.length})
          </h3>

          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task._id}
                className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2"
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
              </div>
            ))}
          </div>
        </div>
      )}

      <StageNextSteps steps={taskGenNextSteps} />
    </div>
  );
}
