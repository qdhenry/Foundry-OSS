"use client";

import { useQuery } from "convex/react";
import { AgentStatusBadge } from "./AgentStatusBadge";

export function AgentHistoryTab({ agentId }: { agentId: string }) {
  const rows = useQuery("agentTeam/executions:listByAgent" as any, { agentId: agentId as any });

  if (rows === undefined) return <p className="text-sm text-text-secondary">Loading history...</p>;
  if (rows.length === 0) return <p className="text-sm text-text-secondary">No executions yet.</p>;

  return (
    <div className="space-y-2">
      {rows.map((exec: any) => (
        <div key={exec._id} className="rounded-lg border border-border-default p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-text-heading">{exec.inputSummary}</span>
            <AgentStatusBadge status={exec.status} />
          </div>

          <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-text-muted">
            <span>{exec.executionMode?.toUpperCase() ?? "SDK"}</span>
            <span>{exec.tokensUsed?.total?.toLocaleString() ?? 0} tokens</span>
            <span>{((exec.durationMs ?? 0) / 1000).toFixed(1)}s</span>
            <span>${(exec.cost ?? 0).toFixed(4)}</span>
          </div>

          {exec.outputSummary && (
            <p className="mt-1.5 text-xs text-text-secondary">{exec.outputSummary}</p>
          )}
        </div>
      ))}
    </div>
  );
}
