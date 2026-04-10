"use client";

import { useQuery } from "convex/react";
import { AgentAvatar } from "../agents/AgentAvatar";
import { AgentStatusBadge } from "../agents/AgentStatusBadge";

export function AgentTeamCard({
  programId,
  programSlug,
}: {
  programId: string;
  programSlug?: string;
}) {
  const agents = useQuery("agentTeam/agents:listByProgram" as any, {
    programId: programId as any,
  });

  const activeRuns = useQuery("orchestration/runs:listActive" as any, {
    programId: programId as any,
  });

  if (agents === undefined) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-border-default bg-surface-default" />
    );
  }

  const active = (agents ?? []).filter((a: any) => a.status !== "archived");

  if (active.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="font-semibold text-text-heading">Agent Team</h3>
        <p className="mt-2 text-sm text-text-muted">No agent team configured</p>
        {programSlug && (
          <a
            href={`/${programSlug}/agents`}
            className="mt-2 inline-block text-xs font-medium text-interactive-primary hover:underline"
          >
            Configure agents
          </a>
        )}
      </div>
    );
  }

  const executingCount = active.filter(
    (a: any) => a.status === "active" || a.status === "executing",
  ).length;
  const idleCount = active.filter((a: any) => a.status === "idle").length;
  const errorCount = active.filter((a: any) => a.status === "error").length;

  const displayAvatars = active.slice(0, 8);
  const overflowCount = active.length - displayAvatars.length;

  const activityPreview = active.slice(0, 3);

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-heading">Agent Team ({active.length})</h3>
        {programSlug && (
          <a
            href={`/${programSlug}/agents`}
            className="text-xs font-medium text-interactive-primary hover:underline"
          >
            Manage Team
          </a>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        {displayAvatars.map((agent: any) => (
          <AgentAvatar key={agent._id} seed={agent.avatarSeed ?? agent._id} name={agent.name} />
        ))}
        {overflowCount > 0 && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-medium text-text-secondary">
            +{overflowCount}
          </span>
        )}
      </div>

      <div className="flex gap-3 text-xs text-text-secondary mt-3">
        <span>
          <span className="font-medium text-status-success-fg">{executingCount}</span> active
        </span>
        <span>
          <span className="font-medium text-text-muted">{idleCount}</span> idle
        </span>
        {errorCount > 0 && (
          <span>
            <span className="font-medium text-status-error-fg">{errorCount}</span> error
          </span>
        )}
      </div>

      <div className="space-y-1.5 mt-3">
        {activityPreview.map((agent: any) => (
          <div key={agent._id} className="flex items-center gap-2 text-xs">
            <AgentStatusBadge status={agent.status} />
            <span className="truncate text-text-primary">{agent.name}</span>
          </div>
        ))}
      </div>

      {/* Orchestration status */}
      <div className="mt-3 border-t border-border-default pt-3">
        {activeRuns && activeRuns.length > 0 ? (
          <a
            href={programSlug ? `/${programSlug}/orchestration` : "#"}
            className="flex items-center justify-between text-xs"
          >
            <span className="font-medium text-status-success-fg">
              {activeRuns.length} run{activeRuns.length !== 1 ? "s" : ""} active
            </span>
            <span className="text-interactive-primary hover:underline">View runs</span>
          </a>
        ) : (
          <a
            href={programSlug ? `/${programSlug}/orchestration` : "#"}
            className="text-xs text-interactive-primary hover:underline"
          >
            Start Orchestration
          </a>
        )}
      </div>
    </div>
  );
}
