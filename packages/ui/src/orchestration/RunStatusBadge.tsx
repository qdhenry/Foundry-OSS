"use client";

type RunStatus =
  | "draft"
  | "previewing"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

const STATUS_CLASSES: Record<RunStatus, string> = {
  draft: "bg-surface-elevated text-text-secondary",
  previewing: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  running: "bg-status-success-bg text-status-success-fg animate-pulse",
  paused: "bg-status-warning-bg text-status-warning-fg",
  completed: "bg-status-success-bg text-status-success-fg",
  failed: "bg-status-error-bg text-status-error-fg",
  cancelled: "bg-surface-elevated text-text-muted",
};

export function RunStatusBadge({ status }: { status: string }) {
  const key = (Object.keys(STATUS_CLASSES).includes(status) ? status : "draft") as RunStatus;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[key]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
