"use client";

import { useMutation } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PIPELINE_STAGE_CONFIG, PIPELINE_STAGES } from "../../../../convex/shared/pipelineStage";
import { type NextStep, StageNextSteps } from "./StageNextSteps";

interface PipelineStageReviewProps {
  requirement: {
    _id: string;
    refId: string;
    title: string;
    description?: string;
    priority: string;
    fitGap: string;
    effortEstimate?: string;
    status: string;
  };
  programId: Id<"programs">;
  workstreamId: Id<"workstreams">;
  tasks: Array<{
    _id: string;
    title: string;
    status: string;
  }>;
}

export function PipelineStageReview({ requirement, tasks }: PipelineStageReviewProps) {
  const updateStatus = useMutation(api.requirements.updateStatus);

  const allDone = tasks.length > 0 && tasks.every((t) => t.status === "done");
  const isComplete = requirement.status === "complete";

  const reviewNextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    if (isComplete) return steps;
    if (allDone) {
      steps.push({
        label: "All tasks done — approve to close this requirement",
        description: "Click 'Approve & Mark Complete' to finalize this requirement.",
      });
    } else {
      const remaining = tasks.filter((t) => t.status !== "done").length;
      steps.push({
        label: `${remaining} task${remaining !== 1 ? "s" : ""} still incomplete`,
        description: "Complete all remaining tasks before the requirement can be approved.",
      });
    }
    return steps;
  }, [isComplete, allDone, tasks]);

  async function handleMarkComplete() {
    await updateStatus({
      requirementId: requirement._id as Id<"requirements">,
      status: "complete",
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Final Review</h3>

        {/* Stage completion summary */}
        <div className="mb-4 space-y-2">
          {PIPELINE_STAGES.slice(0, -1).map((stage) => {
            const config = PIPELINE_STAGE_CONFIG[stage];
            return (
              <div key={stage} className="flex items-center gap-2 text-sm">
                <svg
                  className="h-4 w-4 text-green-500"
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
                <span className="text-text-primary">{config.label}</span>
              </div>
            );
          })}
        </div>

        {/* Task summary */}
        <div className="mb-4 rounded-lg bg-surface-raised p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total Tasks</span>
            <span className="font-medium text-text-heading">{tasks.length}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-text-secondary">Tasks Completed</span>
            <span className="font-medium text-status-success-fg">
              {tasks.filter((t) => t.status === "done").length}
            </span>
          </div>
        </div>

        {/* Requirement details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Requirement</span>
            <span className="font-medium text-text-heading">{requirement.refId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Status</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isComplete
                  ? "bg-status-success-bg text-status-success-fg"
                  : "bg-status-warning-bg text-status-warning-fg"
              }`}
            >
              {isComplete ? "Complete" : "Pending Approval"}
            </span>
          </div>
        </div>

        {/* Actions */}
        {!isComplete && allDone && (
          <div className="mt-4 border-t border-border-default pt-4">
            <p className="mb-3 text-xs text-text-secondary">
              All tasks are complete. Mark this requirement as done to finalize.
            </p>
            <button
              onClick={handleMarkComplete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-status-success-fg px-4 py-2 text-sm font-medium text-text-on-brand hover:opacity-90"
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
              Approve &amp; Mark Complete
            </button>
          </div>
        )}

        {isComplete && (
          <div className="mt-4 rounded-lg border border-status-success-border bg-status-success-bg p-3">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-500"
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
              <span className="text-sm font-medium text-status-success-fg">
                This requirement has been completed and approved.
              </span>
            </div>
          </div>
        )}
      </div>

      <StageNextSteps steps={reviewNextSteps} />
    </div>
  );
}
