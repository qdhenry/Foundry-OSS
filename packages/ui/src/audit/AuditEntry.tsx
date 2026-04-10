"use client";

type Action = "create" | "update" | "delete" | "status_change";

const ACTION_COLORS: Record<Action, { bg: string; text: string; dot: string }> = {
  create: {
    bg: "bg-status-success-bg",
    text: "text-status-success-fg",
    dot: "bg-green-500",
  },
  update: {
    bg: "bg-status-info-bg",
    text: "text-accent-default",
    dot: "bg-blue-500",
  },
  delete: {
    bg: "bg-status-error-bg",
    text: "text-status-error-fg",
    dot: "bg-red-500",
  },
  status_change: {
    bg: "bg-status-warning-bg",
    text: "text-status-warning-fg",
    dot: "bg-amber-500",
  },
};

const ENTITY_BADGE: Record<string, string> = {
  program: "bg-status-success-bg text-status-success-fg",
  requirement: "bg-status-warning-bg text-status-warning-fg",
  risk: "bg-status-error-bg text-status-error-fg",
  task: "bg-status-info-bg text-accent-default",
  skill: "bg-status-info-bg text-status-info-fg",
  gate: "bg-status-warning-bg text-status-warning-fg",
  sprint: "bg-status-success-bg text-status-success-fg",
  integration: "bg-orange-100 text-orange-700",
  document: "bg-surface-raised text-text-primary",
};

function ActionIcon({ action }: { action: Action }) {
  const colors = ACTION_COLORS[action];
  const baseClass = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.bg}`;

  switch (action) {
    case "create":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${colors.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
      );
    case "update":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${colors.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 3.487a2.1 2.1 0 1 1 2.97 2.97L7.5 18.79l-4 1 1-4L16.862 3.487z"
            />
          </svg>
        </span>
      );
    case "delete":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${colors.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
            />
          </svg>
        </span>
      );
    case "status_change":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${colors.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 7l5 5-5 5" />
          </svg>
        </span>
      );
  }
}

/** Format a timestamp as relative time (e.g. "2 minutes ago"). */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export interface AuditEntryData {
  _id: string;
  action: Action;
  entityType: string;
  entityId: string;
  description: string;
  userName: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface AuditEntryProps {
  entry: AuditEntryData;
}

export function AuditEntry({ entry }: AuditEntryProps) {
  const entityBadge = ENTITY_BADGE[entry.entityType] ?? "bg-surface-raised text-text-secondary";

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors hover:bg-interactive-hover">
      {/* Action icon */}
      <ActionIcon action={entry.action} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Entity type badge */}
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entityBadge}`}
          >
            {entry.entityType}
          </span>

          {/* Description */}
          <p className="text-sm text-text-primary line-clamp-1">{entry.description}</p>
        </div>
      </div>

      {/* User + timestamp */}
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium text-text-secondary">{entry.userName}</p>
        <p className="text-[11px] text-text-muted">{formatRelativeTime(entry.timestamp)}</p>
      </div>
    </div>
  );
}
