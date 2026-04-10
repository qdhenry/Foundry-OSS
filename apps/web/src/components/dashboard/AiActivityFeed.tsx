"use client";

import { Stars01 } from "@untitledui/icons";

interface AgentExecution {
  _id: string;
  _creationTime: number;
  skillName?: string;
  taskType?: string;
  status: string;
}

interface AiActivityFeedProps {
  executions: AgentExecution[];
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-status-success-bg text-status-success-fg",
  pending_review: "bg-status-warning-bg text-status-warning-fg",
  running: "bg-status-info-bg text-status-info-fg",
  failed: "bg-status-error-bg text-status-error-fg",
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AiActivityFeed({ executions }: AiActivityFeedProps) {
  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-default py-12">
        <Stars01 size={32} className="mb-3 text-status-success-fg" />
        <p className="text-sm font-medium text-text-heading">No agent executions yet</p>
        <p className="mt-1 text-xs text-text-muted">AI agents will appear here once they run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {executions.map((exec) => {
        const badgeClass = STATUS_BADGE[exec.status] ?? STATUS_BADGE.completed;
        return (
          <div
            key={exec._id}
            className="rounded-lg border border-border-default border-l-4 border-l-status-success-border bg-surface-default p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-heading">
                {exec.skillName ?? "Agent Task"}
              </p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {exec.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
              {exec.taskType && <span>{exec.taskType}</span>}
              <span>{timeAgo(exec._creationTime)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
