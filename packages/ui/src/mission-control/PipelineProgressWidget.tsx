"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useProgramContext } from "../programs/ProgramContext";

interface PipelineProgressWidgetProps {
  programId: string;
}

type PipelineStage =
  | "discovery"
  | "requirement"
  | "sprint_planning"
  | "task_generation"
  | "subtask_generation"
  | "implementation"
  | "testing"
  | "review";

type StageCountsResult = {
  counts: Partial<Record<PipelineStage, number>>;
  total: number;
  progress: number;
};

type WorkstreamListItem = {
  _id: string;
  name: string;
  shortCode: string;
};

const PIPELINE_STAGES: PipelineStage[] = [
  "discovery",
  "requirement",
  "sprint_planning",
  "task_generation",
  "subtask_generation",
  "implementation",
  "testing",
  "review",
];

const PIPELINE_STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; shortLabel: string; order: number }
> = {
  discovery: { label: "Discovery", shortLabel: "Disc.", order: 0 },
  requirement: { label: "Requirement", shortLabel: "Req", order: 1 },
  sprint_planning: {
    label: "Sprint Planning",
    shortLabel: "Sprint",
    order: 2,
  },
  task_generation: {
    label: "Task Generation",
    shortLabel: "Tasks",
    order: 3,
  },
  subtask_generation: {
    label: "Subtask Generation",
    shortLabel: "Subtasks",
    order: 4,
  },
  implementation: { label: "Implementation", shortLabel: "Impl", order: 5 },
  testing: { label: "Testing", shortLabel: "Test", order: 6 },
  review: { label: "Review", shortLabel: "Rev", order: 7 },
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  discovery: "bg-slate-400",
  requirement: "bg-blue-400",
  sprint_planning: "bg-sky-400",
  task_generation: "bg-cyan-400",
  subtask_generation: "bg-teal-400",
  implementation: "bg-status-warning-fg",
  testing: "bg-emerald-400",
  review: "bg-status-success-fg",
};

export function PipelineProgressWidget({ programId }: PipelineProgressWidgetProps) {
  const { slug } = useProgramContext();
  const stageCounts = useQuery("requirements:pipelineStageCounts" as any, {
    programId,
  }) as StageCountsResult | undefined;

  const workstreams = useQuery("workstreams:listByProgram" as any, {
    programId,
  }) as WorkstreamListItem[] | undefined;

  if (stageCounts === undefined || workstreams === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Pipeline Progress</h3>
        <div className="h-40 animate-pulse rounded-lg bg-surface-raised" />
      </div>
    );
  }

  if (stageCounts.total === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Pipeline Progress</h3>
        <p className="text-sm text-text-secondary">No requirements in the pipeline yet.</p>
      </div>
    );
  }

  const { counts, total, progress } = stageCounts;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-heading">Pipeline Progress</h3>
        <span className="text-2xl font-bold text-accent-default">{progress}%</span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mb-3 flex h-6 w-full overflow-hidden rounded-lg">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          if (count === 0) return null;
          const width = (count / total) * 100;
          return (
            <div
              key={stage}
              className={`${STAGE_COLORS[stage]} flex items-center justify-center`}
              style={{ width: `${width}%` }}
              title={`${PIPELINE_STAGE_CONFIG[stage].label}: ${count}`}
            >
              {width > 8 && <span className="text-[9px] font-medium text-white">{count}</span>}
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          if (count === 0) return null;
          return (
            <div key={stage} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage]}`} />
              <span className="text-[10px] text-text-secondary">
                {PIPELINE_STAGE_CONFIG[stage].shortLabel} ({count})
              </span>
            </div>
          );
        })}
      </div>

      {workstreams.length > 0 && (
        <div className="border-t border-border-default pt-3">
          <p className="mb-2 text-xs font-medium text-text-secondary">By Workstream</p>
          <div className="space-y-2">
            {workstreams.map((ws) => (
              <WorkstreamMiniProgress
                key={ws._id}
                programId={programId}
                workstreamId={ws._id}
                workstreamName={ws.name}
                shortCode={ws.shortCode}
                programSlug={slug}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkstreamMiniProgress({
  programId,
  workstreamId,
  workstreamName,
  shortCode,
  programSlug,
}: {
  programId: string;
  workstreamId: string;
  workstreamName: string;
  shortCode: string;
  programSlug: string;
}) {
  const data = useQuery("requirements:pipelineStageCounts" as any, {
    programId,
    workstreamId,
  }) as StageCountsResult | undefined;

  if (data === undefined || data.total === 0) {
    return (
      <Link
        href={`/${programSlug}/workstreams/${workstreamId}`}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-interactive-hover"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-elevated text-[8px] font-bold text-text-secondary">
          {shortCode.slice(0, 2)}
        </span>
        <span className="flex-1 truncate text-xs text-text-primary">{workstreamName}</span>
        <span className="text-[10px] text-text-muted">0 reqs</span>
      </Link>
    );
  }

  return (
    <Link
      href={`/${programSlug}/workstreams/${workstreamId}`}
      className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-interactive-hover"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded bg-status-info-bg text-[8px] font-bold text-accent-default">
        {shortCode.slice(0, 2)}
      </span>
      <span className="flex-1 truncate text-xs text-text-primary">{workstreamName}</span>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${data.progress}%` }} />
        </div>
        <span className="text-[10px] font-medium text-text-secondary">{data.progress}%</span>
      </div>
    </Link>
  );
}
