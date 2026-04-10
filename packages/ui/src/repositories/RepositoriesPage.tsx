"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { useProgramContext } from "../programs";
import { GitHubInstallCTA, RepoCreateModal, RepoPickerDropdown } from "../source-control";
import type { ConnectedRepo } from "../source-control/types";
import { RepoActivityCard } from "./RepoActivityCard";
import { RepoConfigPanel } from "./RepoConfigPanel";

// ---------------------------------------------------------------------------
// ProgramRepositoriesRoute
// ---------------------------------------------------------------------------

export function ProgramRepositoriesRoute() {
  const { programId } = useProgramContext();

  const connectedRepos = useQuery("sourceControl/repositories:listByProgram" as any, {
    programId,
  }) as (ConnectedRepo & { _id: string })[] | undefined;

  const [configuringRepoId, setConfiguringRepoId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isLoading = connectedRepos === undefined;

  const configuringRepo = configuringRepoId
    ? (connectedRepos?.find((r) => r._id === configuringRepoId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-display-m text-text-heading">Repositories</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage connected GitHub repositories for this program.
          </p>
        </div>
        <RepoPickerDropdown
          programId={programId}
          showCreateOption
          onCreateClick={() => setShowCreateModal(true)}
        />
      </div>

      {/* GitHub install CTA */}
      <GitHubInstallCTA purpose="manage repositories" />

      {/* Repo list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border-default bg-surface-raised"
            />
          ))}
        </div>
      ) : connectedRepos.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <p className="text-sm font-medium text-text-secondary">No repositories connected yet.</p>
          <p className="mt-1 text-xs text-text-muted">
            Use the dropdown above to connect a GitHub repository to this program.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connectedRepos.map((repo) => (
            <RepoActivityCard
              key={repo._id}
              repo={repo}
              programId={programId}
              onConfigure={(repoId) =>
                setConfiguringRepoId(configuringRepoId === repoId ? null : repoId)
              }
            />
          ))}
        </div>
      )}

      {/* Config panel — renders below the list */}
      {configuringRepo && (
        <RepoConfigPanel repo={configuringRepo} onClose={() => setConfiguringRepoId(null)} />
      )}

      {/* Create modal */}
      <RepoCreateModal
        programId={programId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
