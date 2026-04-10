"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrchestrationWizard } from "./OrchestrationWizard";
import { RunStatusBadge } from "./RunStatusBadge";

export function OrchestrationRunsPage({ programId }: { programId: string }) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);

  const runs = useQuery("orchestration/runs:listByProgram" as any, {
    programId: programId as any,
  });

  const loading = runs === undefined;

  function formatDuration(startMs?: number, endMs?: number): string {
    if (!startMs) return "--";
    const end = endMs ?? Date.now();
    const seconds = Math.floor((end - startMs) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  function formatCost(tokens?: number): string {
    if (!tokens) return "--";
    // Approximate cost at $3/1M input tokens
    const cost = (tokens / 1_000_000) * 3;
    if (cost < 0.01) return "<$0.01";
    return `$${cost.toFixed(2)}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-text-heading">Orchestration Runs</h1>
          <p className="text-sm text-text-secondary">
            Coordinate multi-agent builds across tasks and repositories.
          </p>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setShowWizard(true)}>
          New Run
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default px-6 py-12 text-center">
          <h3 className="text-lg font-medium text-text-heading">No orchestration runs yet</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Create a new run to coordinate AI agents across your tasks.
          </p>
          <button
            type="button"
            className="btn-primary btn-sm mt-4"
            onClick={() => setShowWizard(true)}
          >
            New Run
          </button>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-subtle">
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Scope</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Tasks</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Tokens</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Cost</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Started</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run: any) => (
                <tr
                  key={run._id}
                  onClick={() => router.push(`/${programId}/orchestration/${run._id}`)}
                  className="cursor-pointer border-b border-border-default transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <td className="px-4 py-3 font-medium text-text-heading">
                    {run.name ?? "Unnamed Run"}
                  </td>
                  <td className="px-4 py-3 capitalize text-text-secondary">
                    {run.scopeType ?? "--"}
                  </td>
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status ?? "draft"} />
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {run.taskCount ?? run.totalTasks ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {run.tokensUsed ? run.tokensUsed.toLocaleString() : "--"}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {formatCost(run.tokensUsed)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleDateString()
                      : run._creationTime
                        ? new Date(run._creationTime).toLocaleDateString()
                        : "--"}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {formatDuration(run.startedAt ?? run._creationTime, run.completedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showWizard && orgId && (
        <OrchestrationWizard
          orgId={orgId}
          programId={programId}
          onClose={() => setShowWizard(false)}
          onComplete={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
