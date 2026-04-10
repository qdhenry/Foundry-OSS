"use client";

import { useMemo } from "react";
import { type NextStep, StageNextSteps } from "./StageNextSteps";

const _SUBTASK_STATUS_BADGE: Record<string, string> = {
  pending: "bg-surface-elevated text-text-secondary",
  executing: "bg-status-warning-bg text-status-warning-fg",
  retrying: "bg-status-warning-bg text-status-warning-fg",
  completed: "bg-status-success-bg text-status-success-fg",
  failed: "bg-status-error-bg text-status-error-fg",
  skipped: "bg-surface-elevated text-text-secondary",
};

interface PipelineStageSubtaskGenProps {
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
    hasSubtasks?: boolean;
    subtaskCount?: number;
    subtasksCompleted?: number;
  }>;
}

export function PipelineStageSubtaskGen({ tasks }: PipelineStageSubtaskGenProps) {
  const subtaskNextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    const awaiting = tasks.filter(
      (t) => !t.hasSubtasks && (!t.subtaskCount || t.subtaskCount === 0),
    );
    if (awaiting.length > 0) {
      steps.push({
        label: `${awaiting.length} task${awaiting.length > 1 ? "s" : ""} awaiting subtask generation`,
        description: "Run subtask generation to break tasks into smaller work items.",
      });
    }
    const withSubtasks = tasks.filter(
      (t) => t.hasSubtasks || (t.subtaskCount && t.subtaskCount > 0),
    );
    if (withSubtasks.length > 0) {
      const incomplete = withSubtasks.filter(
        (t) => (t.subtasksCompleted ?? 0) < (t.subtaskCount ?? 0),
      );
      if (incomplete.length > 0) {
        steps.push({
          label: "Review generated subtasks",
          description: "Check subtask quality and completeness before starting implementation.",
        });
      }
    }
    return steps;
  }, [tasks]);

  // Show subtask status per task
  const tasksWithSubtasks = tasks.filter(
    (t) => t.hasSubtasks || (t.subtaskCount && t.subtaskCount > 0),
  );
  const tasksWithoutSubtasks = tasks.filter(
    (t) => !t.hasSubtasks && (!t.subtaskCount || t.subtaskCount === 0),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Subtask Generation</h3>

        {tasks.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No tasks exist yet. Generate tasks first before creating subtasks.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Tasks with subtasks */}
            {tasksWithSubtasks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-text-secondary">
                  Tasks with Subtasks ({tasksWithSubtasks.length})
                </p>
                <div className="space-y-2">
                  {tasksWithSubtasks.map((task) => (
                    <div
                      key={task._id}
                      className="rounded-lg border border-border-default px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-text-heading">
                          {task.title}
                        </p>
                        <span className="shrink-0 text-xs text-text-secondary">
                          {task.subtasksCompleted ?? 0}/{task.subtaskCount ?? 0} complete
                        </span>
                      </div>
                      {task.subtaskCount && task.subtaskCount > 0 && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${((task.subtasksCompleted ?? 0) / task.subtaskCount) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks without subtasks */}
            {tasksWithoutSubtasks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-text-secondary">
                  Awaiting Subtask Generation ({tasksWithoutSubtasks.length})
                </p>
                <div className="space-y-1">
                  {tasksWithoutSubtasks.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2"
                    >
                      <div className="h-2 w-2 rounded-full bg-border-default" />
                      <p className="truncate text-sm text-text-primary">{task.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <StageNextSteps steps={subtaskNextSteps} />
    </div>
  );
}
