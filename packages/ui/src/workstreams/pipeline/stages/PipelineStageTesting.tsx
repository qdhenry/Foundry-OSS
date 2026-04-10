"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { type NextStep, StageNextSteps } from "./StageNextSteps";

interface PipelineStageTestingProps {
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
  }>;
}

export function PipelineStageTesting({ requirement, tasks }: PipelineStageTestingProps) {
  // Fetch evidence for this requirement
  const requirementDetail = useQuery("requirements:get" as any, {
    requirementId: requirement._id as string,
  });

  const evidenceFiles = requirementDetail?.evidenceFiles ?? [];
  const tasksInReview = tasks.filter((t) => t.status === "review");
  const tasksDone = tasks.filter((t) => t.status === "done");

  const testingNextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    if (tasksInReview.length > 0) {
      steps.push({
        label: `${tasksInReview.length} task${tasksInReview.length !== 1 ? "s" : ""} in review — verify quality and mark as done`,
        description: "Review each task and confirm it meets acceptance criteria.",
      });
    }
    if (evidenceFiles.length === 0) {
      steps.push({
        label: "Upload verification evidence",
        description:
          "Attach test results, screenshots, or other documentation to support sign-off.",
      });
    }
    return steps;
  }, [tasksInReview, evidenceFiles.length]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Testing & Verification</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Tasks in Review</span>
            <span className="text-sm font-medium text-text-heading">{tasksInReview.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Tasks Completed</span>
            <span className="text-sm font-medium text-status-success-fg">{tasksDone.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Total Tasks</span>
            <span className="text-sm text-text-heading">{tasks.length}</span>
          </div>
        </div>
      </div>

      {/* Evidence files */}
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">
          Evidence ({evidenceFiles.length})
        </h3>

        {evidenceFiles.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No evidence uploaded yet. Upload test results, screenshots, or other verification
            documents.
          </p>
        ) : (
          <div className="space-y-2">
            {evidenceFiles.map((file: any) => (
              <div
                key={file._id}
                className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-2"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {file.fileName}
                </span>
                {file.downloadUrl && (
                  <a
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-accent-default"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks in review */}
      {tasksInReview.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-heading">Tasks Under Review</h3>
          <div className="space-y-2">
            {tasksInReview.map((task) => (
              <div
                key={task._id}
                className="flex items-center justify-between rounded-lg bg-status-success-bg px-3 py-2"
              >
                <span className="truncate text-sm text-text-heading">{task.title}</span>
                <span className="shrink-0 rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
                  Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <StageNextSteps steps={testingNextSteps} />
    </div>
  );
}
