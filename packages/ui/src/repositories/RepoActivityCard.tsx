"use client";

import { useQuery } from "convex/react";
import { GithubIcon } from "../source-control/icons";
import type { ConnectedRepo } from "../source-control/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoActivityCardProps {
  repo: ConnectedRepo & { _id: string };
  programId: string;
  onConfigure?: (repoId: string) => void;
}

// ---------------------------------------------------------------------------
// Sync-status badge colour map
// ---------------------------------------------------------------------------

const syncBadge: Record<string, string> = {
  healthy: "bg-status-success-bg text-status-success-fg",
  stale: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
};

// ---------------------------------------------------------------------------
// RepoActivityCard
// ---------------------------------------------------------------------------

export function RepoActivityCard({ repo, programId, onConfigure }: RepoActivityCardProps) {
  // Entity associations
  const tasks = useQuery("sourceControl/entityBindings:listTasksByRepo" as any, {
    programId: programId as any,
    repositoryId: repo._id as any,
  }) as any[] | undefined;

  const workstreams = useQuery("sourceControl/entityBindings:listWorkstreamsByRepo" as any, {
    programId: programId as any,
    repositoryId: repo._id as any,
  }) as any[] | undefined;

  const syncClass = syncBadge[repo.syncStatus] ?? "bg-surface-raised text-text-secondary";

  const githubUrl = `https://github.com/${repo.repoFullName}`;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <GithubIcon className="h-5 w-5 shrink-0 text-text-secondary" />
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-semibold text-text-heading hover:underline"
          >
            {repo.repoFullName}
          </a>
          {/* Sync status badge */}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-medium ${syncClass}`}
          >
            {repo.syncStatus}
          </span>
          {/* Role badge */}
          <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[0.68rem] font-medium text-text-secondary">
            {repo.role.replace(/_/g, " ")}
          </span>
        </div>

        {onConfigure && (
          <button
            type="button"
            onClick={() => onConfigure(repo._id)}
            className="shrink-0 rounded-lg border border-border-default bg-surface-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
          >
            Configure
          </button>
        )}
      </div>

      {/* Entity associations row */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>
          {tasks?.length ?? 0} task{(tasks?.length ?? 0) !== 1 ? "s" : ""}
        </span>
        <span className="text-border-default">|</span>
        <span>
          {workstreams?.length ?? 0} workstream{(workstreams?.length ?? 0) !== 1 ? "s" : ""}
        </span>
        {repo.language && (
          <>
            <span className="text-border-default">|</span>
            <span>{repo.language}</span>
          </>
        )}
        {repo.isMonorepo && (
          <>
            <span className="text-border-default">|</span>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[0.68rem] font-medium text-text-secondary">
              monorepo
            </span>
          </>
        )}
      </div>
    </div>
  );
}
