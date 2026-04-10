"use client";

import { useQuery } from "convex/react";
import {
  type ComponentType,
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

export interface SandboxTaskAuditTrailProps {
  taskId: string;
  defaultCollapsed?: boolean;
}

export interface SandboxConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  isLoading?: boolean;
}

export interface SandboxSurfaceComponents {
  TaskAuditTrail: ComponentType<SandboxTaskAuditTrailProps>;
  ConfirmModal: ComponentType<SandboxConfirmModalProps>;
}

const EVENT_STYLE: Record<string, { label: string; className: string }> = {
  sandbox_started: {
    label: "Sandbox Started",
    className: "bg-status-info-bg text-status-info-fg",
  },
  sandbox_completed: {
    label: "Sandbox Completed",
    className: "bg-status-success-bg text-status-success-fg",
  },
  sandbox_failed: {
    label: "Sandbox Failed",
    className: "bg-status-error-bg text-status-error-fg",
  },
  sandbox_cancelled: {
    label: "Sandbox Cancelled",
    className: "bg-surface-raised text-text-secondary",
  },
  review_accepted: {
    label: "Review Accepted",
    className: "bg-status-success-bg text-status-success-fg",
  },
  review_rejected: {
    label: "Review Rejected",
    className: "bg-status-error-bg text-status-error-fg",
  },
  review_revised: {
    label: "Review Revised",
    className: "bg-status-warning-bg text-status-warning-fg",
  },
  subtask_started: {
    label: "Subtask Started",
    className: "bg-status-info-bg text-status-info-fg",
  },
  subtask_completed: {
    label: "Subtask Completed",
    className: "bg-status-success-bg text-status-success-fg",
  },
  subtask_failed: {
    label: "Subtask Failed",
    className: "bg-status-error-bg text-status-error-fg",
  },
  subtask_retried: {
    label: "Subtask Retried",
    className: "bg-status-warning-bg text-status-warning-fg",
  },
};

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "unknown";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms?: number): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function buildDescription(record: any): string {
  switch (record.eventType) {
    case "sandbox_started":
      return record.environment?.worktreeBranch
        ? `Sandbox launched on branch ${record.environment.worktreeBranch}`
        : "Sandbox execution started";
    case "sandbox_completed":
      return record.outcome?.prNumber
        ? `Execution completed and opened PR #${record.outcome.prNumber}`
        : "Execution completed successfully";
    case "sandbox_failed":
      return record.outcome?.error
        ? `Execution failed: ${record.outcome.error}`
        : "Sandbox execution failed";
    case "sandbox_cancelled":
      return "Sandbox execution was cancelled";
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
      return String(record.eventType ?? "event");
  }
}

function DefaultTaskAuditTrail({ taskId, defaultCollapsed }: SandboxTaskAuditTrailProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? false);
  const records = useQuery(
    "executionAudit:listByTask" as any,
    taskId ? { taskId: taskId as any } : "skip",
  ) as any[] | undefined;

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
          onClick={() => setIsCollapsed((current) => !current)}
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
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
          {records.length} {records.length === 1 ? "event" : "events"}
        </span>
      </div>

      {isCollapsed ? null : records.length === 0 ? (
        <p className="text-xs text-text-muted">No audit events recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {records.map((record: any) => {
            const style = EVENT_STYLE[String(record.eventType)] ?? {
              label: String(record.eventType ?? "event"),
              className: "bg-surface-raised text-text-secondary",
            };
            const durationLabel = formatDuration(record.outcome?.durationMs);
            return (
              <div key={record._id} className="rounded-lg border border-border-default px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className}`}
                  >
                    {style.label}
                  </span>
                  {typeof record.outcome?.filesChanged === "number" ? (
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-text-secondary">
                      {record.outcome.filesChanged} files
                    </span>
                  ) : null}
                  {durationLabel ? (
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-text-secondary">
                      {durationLabel}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-text-muted">
                    {formatRelativeTime(record.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{buildDescription(record)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DefaultConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  isLoading = false,
}: SandboxConfirmModalProps) {
  if (!isOpen) return null;

  const confirmClassName =
    tone === "danger"
      ? "rounded-lg bg-status-error-fg px-3 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-60"
      : "btn-primary btn-sm";

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-default shadow-lg">
        <div className="space-y-2 px-5 py-4">
          <h3 className="text-base font-semibold text-text-heading">{title}</h3>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary btn-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={confirmClassName}
          >
            {isLoading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_SURFACE_COMPONENTS: SandboxSurfaceComponents = {
  TaskAuditTrail: DefaultTaskAuditTrail,
  ConfirmModal: DefaultConfirmModal,
};

const SandboxSurfaceComponentsContext = createContext<SandboxSurfaceComponents>(
  DEFAULT_SURFACE_COMPONENTS,
);

export function SandboxSurfaceComponentsProvider({
  children,
  components,
}: {
  children: ReactNode;
  components?: Partial<SandboxSurfaceComponents>;
}) {
  const value = useMemo<SandboxSurfaceComponents>(
    () => ({
      TaskAuditTrail: components?.TaskAuditTrail ?? DEFAULT_SURFACE_COMPONENTS.TaskAuditTrail,
      ConfirmModal: components?.ConfirmModal ?? DEFAULT_SURFACE_COMPONENTS.ConfirmModal,
    }),
    [components?.TaskAuditTrail, components?.ConfirmModal],
  );

  return (
    <SandboxSurfaceComponentsContext.Provider value={value}>
      {children}
    </SandboxSurfaceComponentsContext.Provider>
  );
}

export function useSandboxSurfaceComponents(): SandboxSurfaceComponents {
  return useContext(SandboxSurfaceComponentsContext);
}
