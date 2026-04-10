"use client";

import type { Id } from "../../../convex/_generated/dataModel";
import type { PipelineStage } from "../../../convex/shared/pipelineStage";
import { PipelineStageDiscovery } from "./stages/PipelineStageDiscovery";
import { PipelineStageImplementation } from "./stages/PipelineStageImplementation";
import { PipelineStageRequirement } from "./stages/PipelineStageRequirement";
import { PipelineStageReview } from "./stages/PipelineStageReview";
import { PipelineStageSprint } from "./stages/PipelineStageSprint";
import { PipelineStageSubtaskGen } from "./stages/PipelineStageSubtaskGen";
import { PipelineStageTaskGen } from "./stages/PipelineStageTaskGen";
import { PipelineStageTesting } from "./stages/PipelineStageTesting";

interface PipelineStageContentProps {
  stage: PipelineStage;
  requirement: {
    _id: string;
    orgId: string;
    refId: string;
    title: string;
    description?: string;
    priority: string;
    fitGap: string;
    effortEstimate?: string;
    status: string;
    workstreamId?: string;
  };
  programId: Id<"programs">;
  workstreamId: Id<"workstreams">;
  tasks: Array<{
    _id: string;
    title: string;
    status: string;
    priority: string;
    assigneeName?: string;
    sprintName?: string;
    hasSubtasks?: boolean;
    subtaskCount?: number;
    subtasksCompleted?: number;
  }>;
  finding?: {
    _id: string;
    status: string;
    type: string;
    confidence?: string;
    sourceExcerpt?: string;
    documentName?: string;
    data?: unknown;
  } | null;
}

export function PipelineStageContent({
  stage,
  requirement,
  programId,
  workstreamId,
  tasks,
  finding,
}: PipelineStageContentProps) {
  const commonProps = {
    requirement,
    programId,
    workstreamId,
    tasks,
  };

  switch (stage) {
    case "discovery":
      return <PipelineStageDiscovery {...commonProps} finding={finding} />;
    case "requirement":
      return <PipelineStageRequirement {...commonProps} />;
    case "sprint_planning":
      return <PipelineStageSprint {...commonProps} />;
    case "task_generation":
      return <PipelineStageTaskGen {...commonProps} />;
    case "subtask_generation":
      return <PipelineStageSubtaskGen {...commonProps} />;
    case "implementation":
      return <PipelineStageImplementation {...commonProps} />;
    case "testing":
      return <PipelineStageTesting {...commonProps} />;
    case "review":
      return <PipelineStageReview {...commonProps} />;
    default:
      return <div className="text-sm text-text-secondary">Unknown pipeline stage.</div>;
  }
}
