interface ActivityLog {
  _id: string;
  _creationTime: number;
  step: string;
  message: string;
  detail?: string;
  level: "info" | "success" | "error";
}

interface VideoActivityFeedProps {
  logs: ActivityLog[] | undefined;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogIcon({ level }: { level: "info" | "success" | "error" }) {
  if (level === "success") {
    return (
      <svg
        className="mt-0.5 h-3 w-3 shrink-0 text-status-success-fg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (level === "error") {
    return (
      <svg
        className="mt-0.5 h-3 w-3 shrink-0 text-status-error-fg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />;
}

export function VideoActivityFeed({ logs }: VideoActivityFeedProps) {
  if (logs === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-4 sm:p-6">
        <p className="text-sm text-text-secondary">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4 sm:p-6">
      <h3 className="mb-3 text-sm font-semibold text-text-heading">Activity Log</h3>

      {logs.length === 0 ? (
        <p className="text-xs text-text-secondary">No activity recorded yet.</p>
      ) : (
        <div className="space-y-1.5 border-l-2 border-border-default pl-3">
          {logs.map((log) => (
            <div key={log._id} className="flex items-start justify-between gap-2 text-xs">
              <div className="flex items-start gap-1.5">
                <LogIcon level={log.level} />
                <span
                  className={log.level === "error" ? "text-status-error-fg" : "text-text-secondary"}
                >
                  {log.message}
                </span>
              </div>
              <span className="shrink-0 text-text-muted">{formatTime(log._creationTime)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
