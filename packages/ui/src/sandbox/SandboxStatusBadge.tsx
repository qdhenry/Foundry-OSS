"use client";

import { RuntimeModeBadge } from "./RuntimeModeBadge";
import { summarizeSetupProgress } from "./StageProgress";

type SandboxStatus =
  | "provisioning"
  | "cloning"
  | "executing"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

interface SandboxStatusBadgeProps {
  status: SandboxStatus;
  prUrl?: string | null;
  setupProgress?: unknown;
  runtimeMode?: string | null;
  showSetupProgress?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string; pulse?: boolean }
> = {
  provisioning: {
    label: "Provisioning",
    badgeClass: "badge-warning",
    dotClass: "bg-status-warning-fg",
    pulse: true,
  },
  cloning: {
    label: "Cloning",
    badgeClass: "badge-info",
    dotClass: "bg-status-info-fg",
  },
  executing: {
    label: "Executing",
    badgeClass: "badge-info",
    dotClass: "bg-status-info-fg",
    pulse: true,
  },
  finalizing: {
    label: "Finalizing",
    badgeClass: "badge-success",
    dotClass: "bg-status-success-fg",
    pulse: true,
  },
  completed: {
    label: "Completed",
    badgeClass: "badge-success",
    dotClass: "bg-status-success-fg",
  },
  failed: {
    label: "Failed",
    badgeClass: "badge-error",
    dotClass: "bg-status-error-fg",
  },
  cancelled: {
    label: "Stopped",
    badgeClass: "border-border-default bg-surface-raised text-text-secondary",
    dotClass: "bg-text-muted",
  },
  sleeping: {
    label: "Sleeping",
    badgeClass: "badge-warning",
    dotClass: "bg-status-warning-fg",
  },
  ready: {
    label: "Ready",
    badgeClass: "badge-success",
    dotClass: "bg-status-success-fg",
  },
};

function formatStatusLabel(status: string) {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SandboxStatusBadge({
  status,
  prUrl,
  setupProgress,
  runtimeMode,
  showSetupProgress = true,
  className,
}: SandboxStatusBadgeProps) {
  const normalizedStatus =
    typeof status === "string" && status.trim().length > 0 ? status.trim() : "unknown";
  const normalizedRuntimeMode =
    typeof runtimeMode === "string" && runtimeMode.trim().length > 0 ? runtimeMode.trim() : null;

  const config = STATUS_CONFIG[normalizedStatus] ?? {
    label: formatStatusLabel(normalizedStatus),
    badgeClass: "border-border-default bg-surface-raised text-text-secondary",
    dotClass: "bg-text-muted",
  };

  const summary = summarizeSetupProgress(setupProgress);
  const progressedStages = summary ? summary.completedStages + summary.skippedStages : 0;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ""}`.trim()}>
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badgeClass}`.trim()}
      >
        <span
          className={`h-2 w-2 rounded-full ${config.dotClass} ${config.pulse ? "animate-pulse" : ""}`.trim()}
        />
        <span>{config.label}</span>
        {showSetupProgress && summary ? (
          <span className="rounded-full bg-surface-overlay px-1.5 py-0 text-[10px] font-semibold">
            Setup {progressedStages}/{summary.totalStages}
          </span>
        ) : null}
        {normalizedStatus === "completed" && prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-1 text-xs font-semibold text-accent-default underline underline-offset-2 hover:opacity-90"
          >
            View PR
          </a>
        ) : null}
      </div>
      {normalizedRuntimeMode ? <RuntimeModeBadge mode={normalizedRuntimeMode} /> : null}
    </div>
  );
}
