"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeploymentTimelineProps {
  programId: Id<"programs">;
  environment?: string;
}

type DeploymentStatus = "pending" | "in_progress" | "success" | "failure" | "error" | "inactive";

const STATUS_CONFIG: Record<DeploymentStatus, { color: string; ring: string; label: string }> = {
  pending: { color: "bg-slate-300", ring: "ring-surface-elevated", label: "Pending" },
  in_progress: {
    color: "bg-status-warning-fg",
    ring: "ring-status-warning-bg",
    label: "In Progress",
  },
  success: { color: "bg-status-success-fg", ring: "ring-status-success-bg", label: "Deployed" },
  failure: { color: "bg-status-error-fg", ring: "ring-status-error-bg", label: "Failed" },
  error: { color: "bg-status-error-fg", ring: "ring-status-error-bg", label: "Error" },
  inactive: { color: "bg-slate-400", ring: "ring-surface-elevated", label: "Inactive" },
};

const ENV_BADGE: Record<string, string> = {
  development: "bg-surface-elevated text-text-secondary",
  staging: "bg-status-warning-bg text-status-warning-fg",
  qa: "bg-status-info-bg text-status-info-fg",
  production: "bg-status-success-bg text-status-success-fg",
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

export function DeploymentTimeline({ programId, environment }: DeploymentTimelineProps) {
  const deployments = useQuery(api.sourceControl.deployments.deploymentTracking.listByProgram, {
    programId,
    environment,
    limit: 20,
  });

  if (deployments === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-text-secondary">Loading deployments...</p>
      </div>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-default px-6 py-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
          <svg
            className="h-6 w-6 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-primary">No deployment data available.</p>
        <p className="mt-1 text-xs text-text-secondary">
          Deployments will appear here when tracked via GitHub webhooks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {deployments.map((deployment: Record<string, any>, idx: number) => {
        const status = deployment.status as DeploymentStatus;
        const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
        const envClass = ENV_BADGE[deployment.environment] ?? ENV_BADGE.development;
        const isLast = idx === deployments.length - 1;

        return (
          <div key={deployment._id} className="relative flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`z-10 h-3 w-3 rounded-full ${config.color} ring-2 ${config.ring}`} />
              {!isLast && <div className="w-0.5 flex-1 bg-border-default" />}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {/* Environment + Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${envClass}`}
                    >
                      {deployment.environment}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        status === "success"
                          ? "text-status-success-fg"
                          : status === "failure" || status === "error"
                            ? "text-status-error-fg"
                            : "text-text-secondary"
                      }`}
                    >
                      {config.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    <span className="font-mono">{deployment.sha.slice(0, 7)}</span>
                    <span>{deployment.ref}</span>
                    {deployment.deployedBy && <span>by {deployment.deployedBy}</span>}
                    {deployment.workflowName && (
                      <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px]">
                        {deployment.workflowName}
                      </span>
                    )}
                  </div>

                  {/* Duration */}
                  {deployment.durationMs && (
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      Duration: {formatDuration(deployment.durationMs)}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <span className="shrink-0 text-xs text-text-muted">
                  {formatTimestamp(deployment.deployedAt)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
