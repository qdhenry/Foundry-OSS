"use client";

interface RunActivityFeedProps {
  events: any[];
}

const TYPE_COLORS: Record<string, string> = {
  completed: "bg-status-success-fg",
  success: "bg-status-success-fg",
  failed: "bg-status-error-fg",
  error: "bg-status-error-fg",
  cancelled: "bg-status-error-fg",
  warning: "bg-status-warning-fg",
  paused: "bg-status-warning-fg",
  started: "bg-blue-500",
  running: "bg-blue-500",
  info: "bg-blue-500",
  assigned: "bg-blue-500",
  queued: "bg-text-muted",
};

function dotColor(type: string): string {
  return TYPE_COLORS[type] ?? "bg-text-muted";
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RunActivityFeed({ events }: RunActivityFeedProps) {
  const sorted = [...(events ?? [])].sort(
    (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0),
  );
    (a: any, b: any) => (b._creationTime ?? 0) - (a._creationTime ?? 0),
  );

  if (sorted.length === 0) {
    return <div className="py-8 text-center text-sm text-text-muted">No activity yet.</div>;
  }

  return (
    <div className="max-h-[400px] space-y-1 overflow-y-auto">
      {sorted.map((event: any, i: number) => {
        const eventType = event.type ?? event.eventType ?? "info";
        const message = event.message ?? event.description ?? event.summary ?? `${eventType} event`;
        const timestamp = event._creationTime ?? event.timestamp ?? 0;

        return (
          <div
            key={event._id ?? `event-${i}`}
            className="flex items-start gap-2.5 rounded-lg px-3 py-2 hover:bg-surface-subtle"
          >
            <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor(eventType)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-primary">{message}</p>
              {timestamp > 0 && (
                <p className="mt-0.5 text-[10px] text-text-muted">{relativeTime(timestamp)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
