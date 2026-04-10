"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { SandboxLogSummary } from "./SandboxLogSummary";

type EventType =
  | "sandbox_started"
  | "sandbox_completed"
  | "sandbox_failed"
  | "sandbox_cancelled"
  | "review_accepted"
  | "review_rejected"
  | "review_revised"
  | "subtask_started"
  | "subtask_completed"
  | "subtask_failed"
  | "subtask_retried";

const EVENT_CONFIG: Record<
  EventType,
  { label: string; icon: string; bg: string; text: string; dot: string }
> = {
  sandbox_started: {
    label: "Sandbox Started",
    icon: "play",
    bg: "bg-status-info-bg",
    text: "text-accent-default",
    dot: "bg-accent-default",
  },
  sandbox_completed: {
    label: "Sandbox Completed",
    icon: "check",
    bg: "bg-status-success-bg",
    text: "text-status-success-fg",
    dot: "bg-status-success-fg",
  },
  sandbox_failed: {
    label: "Sandbox Failed",
    icon: "x",
    bg: "bg-status-error-bg",
    text: "text-status-error-fg",
    dot: "bg-status-error-fg",
  },
  sandbox_cancelled: {
    label: "Sandbox Cancelled",
    icon: "stop",
    bg: "bg-surface-raised",
    text: "text-text-secondary",
    dot: "bg-text-muted",
  },
  review_accepted: {
    label: "Review Accepted",
    icon: "check",
    bg: "bg-status-success-bg",
    text: "text-status-success-fg",
    dot: "bg-status-success-fg",
  },
  review_rejected: {
    label: "Review Rejected",
    icon: "x",
    bg: "bg-status-error-bg",
    text: "text-status-error-fg",
    dot: "bg-status-error-fg",
  },
  review_revised: {
    label: "Review Revised",
    icon: "edit",
    bg: "bg-status-warning-bg",
    text: "text-status-warning-fg",
    dot: "bg-status-warning-fg",
  },
  subtask_started: {
    label: "Subtask Started",
    icon: "play",
    bg: "bg-status-info-bg",
    text: "text-accent-default",
    dot: "bg-accent-default",
  },
  subtask_completed: {
    label: "Subtask Completed",
    icon: "check",
    bg: "bg-status-success-bg",
    text: "text-status-success-fg",
    dot: "bg-status-success-fg",
  },
  subtask_failed: {
    label: "Subtask Failed",
    icon: "x",
    bg: "bg-status-error-bg",
    text: "text-status-error-fg",
    dot: "bg-status-error-fg",
  },
  subtask_retried: {
    label: "Subtask Retried",
    icon: "edit",
    bg: "bg-status-warning-bg",
    text: "text-status-warning-fg",
    dot: "bg-status-warning-fg",
  },
};

function EventIcon({ eventType }: { eventType: EventType }) {
  const config = EVENT_CONFIG[eventType] ?? EVENT_CONFIG.sandbox_started;
  const baseClass = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bg}`;

  switch (config.icon) {
    case "play":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${config.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
          </svg>
        </span>
      );
    case "check":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${config.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case "x":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${config.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      );
    case "stop":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${config.text}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </span>
      );
    case "edit":
      return (
        <span className={baseClass}>
          <svg
            className={`h-3.5 w-3.5 ${config.text}`}
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
    default:
      return <span className={baseClass} />;
  }
}

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

interface TaskAuditTrailProps {
  taskId: string;
  defaultCollapsed?: boolean;
}

export function TaskAuditTrail({ taskId, defaultCollapsed }: TaskAuditTrailProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? false);
  const records = useQuery(
    "executionAudit:listByTask" as any,
    taskId ? { taskId: taskId as any } : "skip",
  );

  if (records === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h2 className="text-sm font-semibold text-text-primary">Audit Trail</h2>
        <p className="mt-2 text-sm text-text-muted">Loading audit records...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed((c) => !c)}
          className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Audit Trail
        </button>
        {records.length > 0 && (
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
            {records.length} {records.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      {!isCollapsed &&
        (records.length === 0 ? (
          <div className="py-6 text-center">
            <svg
              className="mx-auto mb-2 h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xs text-text-muted">No audit events recorded yet.</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Events will appear here when sandbox executions run.
            </p>
          </div>
        ) : (
          <div className="relative ml-3">
            {/* Vertical timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border-default" />

            <div className="space-y-0.5">
              {records.map((record: any) => {
                const config =
                  EVENT_CONFIG[record.eventType as EventType] ?? EVENT_CONFIG.sandbox_started;
                return (
                  <div key={record._id} className="relative flex items-start">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 top-4 z-10 h-2 w-2 -translate-x-[3.5px] rounded-full ring-2 ring-surface-default ${config.dot}`}
                    />

                    {/* Entry content */}
                    <div className="ml-4 flex-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-interactive-hover">
                      <div className="flex items-start gap-3">
                        <EventIcon eventType={record.eventType as EventType} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.bg} ${config.text}`}
                            >
                              {config.label}
                            </span>
                          </div>

                          {/* Description line */}
                          <p className="mt-1 text-sm text-text-secondary">
                            {buildDescription(record)}
                          </p>

                          {/* Metadata pills */}
                          {renderMetadataPills(record)}

                          {/* Tail telemetry */}
                          {record.metadata?.tailTelemetry && (
                            <TailTelemetrySummary telemetry={record.metadata.tailTelemetry} />
                          )}

                          {/* Sandbox log summary */}
                          {record.eventType === "sandbox_started" && (
                            <SandboxLogSummary taskId={record.taskId} />
                          )}
                        </div>

                        {/* User + timestamp */}
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium text-text-secondary">
                            {record.initiatedByName}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {formatRelativeTime(record.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

function buildDescription(record: any): string {
  switch (record.eventType) {
    case "sandbox_started":
      return record.environment?.worktreeBranch
        ? `Sandbox launched on branch ${record.environment.worktreeBranch}`
        : "Sandbox execution started";
    case "sandbox_completed": {
      const parts: string[] = ["Execution completed successfully"];
      if (record.outcome?.prNumber) {
        parts[0] = `Execution completed — PR #${record.outcome.prNumber} created`;
      }
      return parts[0];
    }
    case "sandbox_failed":
      return record.outcome?.error
        ? `Execution failed: ${record.outcome.error}`
        : "Sandbox execution failed";
    case "sandbox_cancelled":
      return "Sandbox execution was cancelled by user";
    case "review_accepted":
      return "Agent output was accepted";
    case "review_rejected":
      return "Agent output was rejected";
    case "review_revised":
      return "Agent output was revised";
    case "subtask_started":
      return record.metadata?.subtaskTitle
        ? `Subtask "${record.metadata.subtaskTitle}" started`
        : "Subtask execution started";
    case "subtask_completed":
      return record.metadata?.subtaskTitle
        ? `Subtask "${record.metadata.subtaskTitle}" completed`
        : "Subtask completed successfully";
    case "subtask_failed":
      return record.outcome?.error
        ? `Subtask failed: ${record.outcome.error}`
        : "Subtask execution failed";
    case "subtask_retried":
      return record.metadata?.subtaskTitle
        ? `Subtask "${record.metadata.subtaskTitle}" retried`
        : "Subtask execution retried";
    default:
      return record.eventType;
  }
}

function renderMetadataPills(record: any) {
  const pills: { label: string; value: string }[] = [];

  if (record.outcome?.filesChanged !== undefined) {
    pills.push({ label: "Files", value: `${record.outcome.filesChanged} changed` });
  }
  if (record.outcome?.tokensUsed !== undefined) {
    pills.push({ label: "Tokens", value: record.outcome.tokensUsed.toLocaleString() });
  }
  if (record.outcome?.durationMs !== undefined) {
    pills.push({ label: "Duration", value: formatDuration(record.outcome.durationMs) });
  }
  if (record.skillName) {
    pills.push({ label: "Skill", value: record.skillName });
  }

  if (pills.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className="inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-text-secondary"
        >
          <span className="font-medium">{pill.label}:</span> {pill.value}
        </span>
      ))}
    </div>
  );
}

// ── Tail Telemetry ────────────────────────────────────────────────────────────

interface TailInvocation {
  route: string;
  method: string;
  outcome: string;
  eventTimestamp: number;
  cpuTimeMs?: number;
  logCount?: number;
  exceptionCount?: number;
}

interface TailTelemetry {
  invocations: TailInvocation[];
  totalCpuTimeMs: number;
  totalInvocations: number;
  errorCount: number;
  exceptionCount: number;
}

const OUTCOME_DOT: Record<string, string> = {
  ok: "bg-status-success-fg",
  exception: "bg-status-error-fg",
  exceededCpu: "bg-status-warning-fg",
  exceededMemory: "bg-status-warning-fg",
  canceled: "bg-text-muted",
};

function TailTelemetrySummary({ telemetry }: { telemetry: TailTelemetry }) {
  const [expanded, setExpanded] = useState(false);

  const { totalInvocations, totalCpuTimeMs, errorCount, exceptionCount } = telemetry;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Worker Telemetry
        <span className="rounded bg-surface-raised px-1.5 py-0.5 font-normal">
          {totalInvocations} request{totalInvocations !== 1 ? "s" : ""}
        </span>
        {totalCpuTimeMs > 0 && (
          <span className="rounded bg-surface-raised px-1.5 py-0.5 font-normal">
            {formatDuration(totalCpuTimeMs)} CPU
          </span>
        )}
        {errorCount > 0 && (
          <span className="rounded bg-status-error-bg px-1.5 py-0.5 font-normal text-status-error-fg">
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceptionCount > 0 && (
          <span className="rounded bg-status-error-bg px-1.5 py-0.5 font-normal text-status-error-fg">
            {exceptionCount} exception{exceptionCount !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {expanded && telemetry.invocations.length > 0 && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-border-default">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised">
                <th className="px-2 py-1 text-left font-medium text-text-secondary">Route</th>
                <th className="px-2 py-1 text-left font-medium text-text-secondary">Method</th>
                <th className="px-2 py-1 text-left font-medium text-text-secondary">Outcome</th>
                <th className="px-2 py-1 text-right font-medium text-text-secondary">CPU</th>
                <th className="px-2 py-1 text-right font-medium text-text-secondary">Logs</th>
                <th className="px-2 py-1 text-right font-medium text-text-secondary">Time</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.invocations.map((inv, i) => (
                <tr key={i} className="border-b border-border-default last:border-0">
                  <td className="px-2 py-1 font-mono text-text-secondary">{inv.route}</td>
                  <td className="px-2 py-1 text-text-secondary">{inv.method}</td>
                  <td className="px-2 py-1">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${OUTCOME_DOT[inv.outcome] ?? "bg-text-muted"}`}
                      />
                      <span
                        className={
                          inv.outcome === "ok" ? "text-status-success-fg" : "text-status-error-fg"
                        }
                      >
                        {inv.outcome}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right text-text-secondary">
                    {inv.cpuTimeMs != null ? `${inv.cpuTimeMs}ms` : "-"}
                  </td>
                  <td className="px-2 py-1 text-right text-text-secondary">{inv.logCount ?? 0}</td>
                  <td className="px-2 py-1 text-right text-text-muted">
                    {formatTelemetryTime(inv.eventTimestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTelemetryTime(ts: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
