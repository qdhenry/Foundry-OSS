"use client";

type AgentStatus = "active" | "idle" | "executing" | "error" | "paused" | "archived";

const STATUS_CLASSES: Record<AgentStatus, string> = {
  active: "bg-status-success-bg text-status-success-fg",
  idle: "bg-surface-elevated text-text-secondary",
  executing: "bg-status-info-bg text-status-info-fg",
  error: "bg-status-error-bg text-status-error-fg",
  paused: "bg-status-warning-bg text-status-warning-fg",
  archived: "bg-surface-subtle text-text-muted",
};

export function AgentStatusBadge({ status }: { status: AgentStatus | string }) {
  const key = (Object.keys(STATUS_CLASSES).includes(status) ? status : "idle") as AgentStatus;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[key]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
