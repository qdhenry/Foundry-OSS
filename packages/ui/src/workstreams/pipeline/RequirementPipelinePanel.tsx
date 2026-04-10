"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProgramContext } from "../../programs";
import { PipelineActivityLog } from "./PipelineActivityLog";
import { PipelineStageContent } from "./PipelineStageContent";
import { PipelineStepper } from "./PipelineStepper";
import { derivePipelineStage, PIPELINE_STAGE_CONFIG, type PipelineStage } from "./pipelineStage";

const PRIORITY_BADGE: Record<string, string> = {
  must_have: "bg-status-error-bg text-status-error-fg",
  should_have: "bg-status-warning-bg text-status-warning-fg",
  nice_to_have: "bg-status-info-bg text-accent-default",
  deferred: "bg-surface-elevated text-text-secondary",
};

const PRIORITY_LABEL: Record<string, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const FIT_GAP_BADGE: Record<string, string> = {
  native: "bg-status-success-bg text-status-success-fg",
  config: "bg-status-warning-bg text-status-warning-fg",
  custom_dev: "bg-status-success-bg text-status-success-fg",
  third_party: "bg-status-warning-bg text-status-warning-fg",
  not_feasible: "bg-status-error-bg text-status-error-fg",
};

const FIT_GAP_LABEL: Record<string, string> = {
  native: "Native",
  config: "Config",
  custom_dev: "Custom Dev",
  third_party: "3rd Party",
  not_feasible: "Not Feasible",
};

interface RequirementPipelinePanelProps {
  requirementId: string;
  programId: string;
  workstreamId: string;
  onClose: () => void;
  referrer?: string;
}

export function RequirementPipelinePanel({
  requirementId,
  programId,
  workstreamId,
  onClose,
  referrer,
}: RequirementPipelinePanelProps) {
  const { slug } = useProgramContext();
  const requirement = useQuery("requirements:get" as any, { requirementId });

  // Fetch tasks for this requirement to derive pipeline stage
  const tasks = useQuery("tasks:listByProgram" as any, {
    programId,
  });

  // Fetch findings
  const findings = useQuery("discoveryFindings:listByProgram" as any, {
    programId,
  });

  const [viewingStage, setViewingStage] = useState<PipelineStage | null>(null);

  // Derive pipeline stage
  const reqTasks = tasks?.filter((t: any) => t.requirementId === requirementId) ?? [];

  // Find linked finding
  const linkedFinding = findings?.find((f: any) => {
    const importedAs = f.importedAs as { type: string; id: string } | undefined;
    return importedAs?.type === "requirement" && importedAs.id === requirementId;
  });

  const pipelineStage = requirement
    ? derivePipelineStage({
        requirement: {
          status: requirement.status,
          workstreamId: requirement.workstreamId ?? null,
          sprintId: reqTasks.find((t: any) => t.sprintId)?.sprintId ?? null,
        },
        finding: linkedFinding ? { status: linkedFinding.status } : null,
        decomposition: null,
        tasks: reqTasks.map((t: any) => ({
          status: t.status,
          hasSubtasks: t.hasSubtasks,
          subtaskGenerationStatus: t.subtaskGenerationStatus,
        })),
      })
    : "requirement";

  // Default viewing stage to current pipeline stage
  useEffect(() => {
    if (pipelineStage && !viewingStage) {
      setViewingStage(pipelineStage);
    }
  }, [pipelineStage, viewingStage]);

  const currentViewStage = viewingStage ?? pipelineStage;

  if (requirement === undefined) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-y-0 right-0 z-10 flex w-full flex-col bg-surface-default shadow-2xl md:w-1/2">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (requirement === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop click to close */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Slideout panel — right side, 50% width on desktop, full on mobile */}
      <div className="absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-border-default bg-surface-default shadow-2xl md:w-1/2">
        {/* Header */}
        <div className="shrink-0 border-b border-border-default px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                {referrer === "discovery" && (
                  <Link
                    href={`/${slug}/discovery?tab=imported`}
                    className="flex items-center gap-1 text-sm text-accent-default"
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
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    Back to Discovery Hub
                  </Link>
                )}
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to Pipeline
                </button>
              </div>
              <h2 className="text-lg font-bold text-text-heading">
                {requirement.refId} &middot; {requirement.title}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[requirement.priority] ?? ""}`}
                >
                  {PRIORITY_LABEL[requirement.priority] ?? requirement.priority}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${FIT_GAP_BADGE[requirement.fitGap] ?? ""}`}
                >
                  {FIT_GAP_LABEL[requirement.fitGap] ?? requirement.fitGap}
                </span>
                <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-xs font-medium text-accent-default">
                  {PIPELINE_STAGE_CONFIG[pipelineStage].label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted hover:bg-interactive-hover hover:text-text-primary"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="shrink-0 border-b border-border-default px-6 py-4">
          <PipelineStepper currentStage={pipelineStage} onStageClick={setViewingStage} />
        </div>

        {/* Stage content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <PipelineStageContent
            stage={currentViewStage}
            requirement={requirement}
            programId={programId}
            workstreamId={workstreamId}
            tasks={reqTasks}
            finding={linkedFinding}
            onNavigateToStage={setViewingStage}
          />

          {/* Activity Log */}
          <div className="mt-6">
            <PipelineActivityLog
              programId={programId}
              requirementId={requirementId}
              currentStage={currentViewStage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
