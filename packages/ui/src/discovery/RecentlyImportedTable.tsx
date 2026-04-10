"use client";

import Link from "next/link";
import { useProgramContext } from "../programs";
import {
  PIPELINE_STAGE_CONFIG,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGES,
  type PipelineStage,
} from "./pipelineStage";

const STAGE_BADGE_COLORS: Record<PipelineStage, string> = {
  discovery: "bg-surface-elevated text-text-secondary",
  requirement: "bg-status-info-bg text-status-info-fg",
  sprint_planning: "bg-status-info-bg text-status-info-fg",
  task_generation: "bg-status-warning-bg text-status-warning-fg",
  subtask_generation: "bg-status-warning-bg text-status-warning-fg",
  implementation: "bg-status-info-bg text-status-info-fg",
  testing: "bg-status-success-bg text-status-success-fg",
  review: "bg-status-success-bg text-status-success-fg",
};

function MiniProgressBar({ stage }: { stage: PipelineStage }) {
  const currentOrder = PIPELINE_STAGE_ORDER[stage];

  return (
    <div className="flex items-center gap-[2px]" title={PIPELINE_STAGE_CONFIG[stage].label}>
      {PIPELINE_STAGES.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 w-2.5 rounded-sm ${
            i <= currentOrder ? "bg-accent-default" : "bg-surface-elevated"
          }`}
        />
      ))}
    </div>
  );
}

interface RecentlyImportedTableProps {
  programId: string;
  data: { items: any[]; continueCursor?: string | null; totalCount?: number } | undefined;
  workstreams: any[];
}

export function RecentlyImportedTable({
  programId,
  data,
  workstreams,
}: RecentlyImportedTableProps) {
  const { slug } = useProgramContext();
  if (data === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-raised" />
          ))}
        </div>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <p className="text-sm text-text-secondary">
          No requirements have been imported from discovery findings yet. Upload and analyze
          documents, then approve findings to import them.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
        <h3 className="text-sm font-semibold text-text-heading">
          Recently Imported ({data.totalCount ?? data.items.length})
        </h3>
        {workstreams.length > 0 && (
          <Link
            href={`/${slug}/workstreams`}
            className="text-xs font-medium text-accent-default hover:text-accent-strong"
          >
            View All Workstreams
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-default text-xs text-text-secondary">
            <tr>
              <th className="px-5 py-2 font-medium">Ref ID</th>
              <th className="px-5 py-2 font-medium">Title</th>
              <th className="px-5 py-2 font-medium">Pipeline Stage</th>
              <th className="px-5 py-2 font-medium">Workstream</th>
              <th className="px-5 py-2 font-medium">Source</th>
              <th className="px-5 py-2 font-medium">Imported</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: any) => {
              const stage = item.pipelineStage as PipelineStage;
              return (
                <tr
                  key={item._id}
                  className="border-b border-border-default hover:bg-interactive-hover"
                >
                  <td className="px-5 py-2 font-mono text-xs text-text-secondary">{item.refId}</td>
                  <td className="max-w-[300px] truncate px-5 py-2 text-text-heading">
                    {item.workstreamId ? (
                      <Link
                        href={`/${slug}/workstreams/${item.workstreamId}?highlight=${item._id}&from=discovery`}
                        className="hover:text-accent-default hover:underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </td>
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STAGE_BADGE_COLORS[stage] ?? STAGE_BADGE_COLORS.discovery
                        }`}
                      >
                        {PIPELINE_STAGE_CONFIG[stage]?.label ?? stage}
                      </span>
                      <MiniProgressBar stage={stage} />
                    </div>
                  </td>
                  <td className="px-5 py-2 text-text-secondary">
                    {item.workstreamName ?? "\u2014"}
                  </td>
                  <td className="max-w-[150px] truncate px-5 py-2 text-text-secondary">
                    {item.sourceDocumentName}
                  </td>
                  <td className="px-5 py-2 text-xs text-text-muted">
                    {new Date(item.importedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
