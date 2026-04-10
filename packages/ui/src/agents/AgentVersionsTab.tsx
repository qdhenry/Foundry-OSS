"use client";

import { useQuery } from "convex/react";

export function AgentVersionsTab({ agentId }: { agentId: string }) {
  const rows = useQuery("agentTeam/versions:listByAgent" as any, { agentId: agentId as any });

  if (rows === undefined) return <p className="text-sm text-text-secondary">Loading versions...</p>;
  if (rows.length === 0) return <p className="text-sm text-text-secondary">No versions yet.</p>;

  const sorted = [...rows].sort((a: any, b: any) => b.version - a.version);

  return (
    <div className="space-y-2">
      {sorted.map((row: any) => {
        const date = row._creationTime
          ? new Date(row._creationTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;

        const diffEntries = row.diff
          ? Object.entries(row.diff).filter(([key]) => key !== "initial")
          : [];

        return (
          <div key={row._id} className="rounded-lg border border-border-default p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-heading">v{row.version}</span>
              {date && <span className="text-xs text-text-muted">{date}</span>}
            </div>

            {row.diff?.initial ? (
              <p className="mt-1.5 text-xs text-text-secondary">Initial version</p>
            ) : (
              diffEntries.length > 0 && (
                <div className="mt-2 space-y-1">
                  {diffEntries.map(([field, change]: [string, any]) => (
                    <div key={field} className="flex items-baseline gap-2 text-xs">
                      <span className="font-medium text-text-secondary">{field}:</span>
                      {change?.from !== undefined && (
                        <span className="text-status-error-fg line-through">
                          {String(change.from).slice(0, 50)}
                          {String(change.from).length > 50 ? "\u2026" : ""}
                        </span>
                      )}
                      {change?.to !== undefined && (
                        <span className="text-status-success-fg">
                          {String(change.to).slice(0, 50)}
                          {String(change.to).length > 50 ? "\u2026" : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
