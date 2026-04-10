"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RuntimeModeBadge } from "./RuntimeModeBadge";
import { useSandboxHUD } from "./SandboxHUDContext";
import { SandboxStatusBadge } from "./SandboxStatusBadge";
import { useSandboxSurfaceComponents } from "./SandboxSurfaceComponents";

interface ProgramLite {
  _id: string;
  name: string;
  slug?: string;
  clientName?: string;
}

interface SandboxTaskLite {
  _id: string;
  title: string;
}

interface SandboxSessionLite {
  _id: string;
  status: string;
  taskId?: string;
  taskTitle?: string;
  worktreeBranch?: string | null;
  runtimeMode?: string | null;
  setupProgress?: unknown;
  startedAt?: number;
  completedAt?: number;
  updatedAt?: number;
  lastActivityAt?: number;
  ttlMinutes?: number;
  sleepAfter?: string;
  expiresAt?: number;
  isPinned?: boolean;
}

type PendingAction = "connecting" | "pinning" | "terminating" | "deleting";
type BulkAction = "terminateIdle" | "deleteCompleted";

interface SandboxManagerFilters {
  status: string;
  runtimeMode: string;
  search: string;
}

interface NoticeState {
  tone: "info" | "success" | "error";
  message: string;
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    if (message != null) {
      try {
        const serialized = JSON.stringify(message);
        if (serialized && serialized !== "{}") return serialized;
      } catch {
        // Fall through to fallback.
      }
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to fallback.
  }
  return fallback;
}

const STATUS_ORDER: Record<string, number> = {
  executing: 0,
  ready: 1,
  sleeping: 2,
  cloning: 3,
  provisioning: 4,
  finalizing: 5,
  failed: 6,
  completed: 7,
  cancelled: 8,
};

const RUNTIME_MODE_ORDER: Record<string, number> = {
  idle: 0,
  executing: 1,
  interactive: 2,
  hibernating: 3,
};

const STATUS_FILTER_DEFAULTS = [
  "executing",
  "ready",
  "sleeping",
  "cloning",
  "provisioning",
  "finalizing",
  "completed",
  "failed",
  "cancelled",
];

const RUNTIME_MODE_FILTER_DEFAULTS = ["idle", "executing", "interactive", "hibernating"];

function isTerminalStatus(status: string) {
  return (
    status === "completed" || status === "failed" || status === "cancelled" || status === "deleting"
  );
}

function isCompletedCleanupStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function formatTokenLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLastActivityTimestamp(session: SandboxSessionLite) {
  return (
    session.lastActivityAt ?? session.updatedAt ?? session.completedAt ?? session.startedAt ?? 0
  );
}

function parseSleepAfterToMinutes(sleepAfter?: string) {
  if (!sleepAfter) return 15;
  const normalized = sleepAfter.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*([hm])$/);
  if (!match) return 15;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 15;
  return match[2] === "h" ? value * 60 : value;
}

function getTtlMinutes(session: SandboxSessionLite) {
  if (typeof session.ttlMinutes === "number" && Number.isFinite(session.ttlMinutes)) {
    return session.ttlMinutes;
  }
  return parseSleepAfterToMinutes(session.sleepAfter);
}

function formatDuration(ms: number) {
  if (ms <= 0) return "expired";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatTimeAgo(timestamp?: number) {
  if (!timestamp) return "Unknown";
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.floor(deltaMs / 60000);
  if (deltaMinutes < 1) return "Just now";
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function getTtlRemainingLabel(session: SandboxSessionLite) {
  const ttlMinutes = getTtlMinutes(session);
  const start = session.startedAt ?? Date.now();
  const expiresAt =
    typeof session.expiresAt === "number" ? session.expiresAt : start + ttlMinutes * 60000;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "expired";
  return formatDuration(remaining);
}

function isFunctionMissingError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : (() => {
            try {
              return JSON.stringify(error ?? "");
            } catch {
              return "";
            }
          })();
  return /Could not find public function|is not registered|Function not found|Unknown function|does not exist/i.test(
    message,
  );
}

function isValidationError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : (() => {
            try {
              return JSON.stringify(error ?? "");
            } catch {
              return "";
            }
          })();
  return /ArgumentValidationError|extra field|unexpected field|Object has extra|missing required/i.test(
    message,
  );
}

async function tryPinMutation(
  convex: ReturnType<typeof useConvex>,
  sessionId: string,
  nextPinned: boolean,
) {
  const attempts = nextPinned
    ? [
        { fn: "sandbox/sessions:pin", args: { sessionId } },
        { fn: "sandbox/sessions:setPinned", args: { sessionId, isPinned: true } },
        { fn: "sandbox/sessions:togglePin", args: { sessionId, isPinned: true } },
        { fn: "sandbox/orchestrator:pin", args: { sessionId } },
      ]
    : [
        { fn: "sandbox/sessions:unpin", args: { sessionId } },
        { fn: "sandbox/sessions:setPinned", args: { sessionId, isPinned: false } },
        { fn: "sandbox/sessions:togglePin", args: { sessionId, isPinned: false } },
        { fn: "sandbox/orchestrator:unpin", args: { sessionId } },
      ];

  for (const attempt of attempts) {
    try {
      await convex.mutation(attempt.fn as any, attempt.args as any);
      return true;
    } catch (error) {
      if (isFunctionMissingError(error) || isValidationError(error)) {
        continue;
      }
      throw error;
    }
  }

  return false;
}

function SandboxProgramGroup({
  program,
  isCollapsed,
  filters,
  hasActiveFilters,
  effectivePins,
  pendingBySession,
  bulkPending,
  onToggleCollapsed,
  onConnect,
  onTogglePin,
  onTerminate,
  onDelete,
  onBulkTerminateIdle,
  onBulkDelete,
}: {
  program: ProgramLite;
  isCollapsed: boolean;
  filters: SandboxManagerFilters;
  hasActiveFilters: boolean;
  effectivePins: Record<string, boolean>;
  pendingBySession: Record<string, PendingAction | undefined>;
  bulkPending: BulkAction | null;
  onToggleCollapsed: (programId: string) => void;
  onConnect: (session: SandboxSessionLite, taskTitle: string, programSlug: string) => Promise<void>;
  onTogglePin: (session: SandboxSessionLite) => Promise<void>;
  onTerminate: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => void;
  onBulkTerminateIdle: (sessions: SandboxSessionLite[]) => Promise<void>;
  onBulkDelete: (sessions: SandboxSessionLite[]) => void;
}) {
  const sessions = useQuery("sandbox/sessions:listByProgram" as any, {
    programId: program._id as any,
  }) as SandboxSessionLite[] | undefined;
  const tasks = useQuery("tasks:listByProgram" as any, {
    programId: program._id as any,
  }) as SandboxTaskLite[] | undefined;

  const tasksById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks ?? []) {
      map.set(String(task._id), task.title);
    }
    return map;
  }, [tasks]);

  const sortedSessions = useMemo(() => {
    const list = [...(sessions ?? [])];
    list.sort((a, b) => {
      const aOrder = STATUS_ORDER[a.status] ?? 999;
      const bOrder = STATUS_ORDER[b.status] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return getLastActivityTimestamp(b) - getLastActivityTimestamp(a);
    });
    return list;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return sortedSessions.filter((session) => {
      if (filters.status !== "all" && session.status !== filters.status) {
        return false;
      }
      if (filters.runtimeMode !== "all" && (session.runtimeMode ?? "") !== filters.runtimeMode) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }

      const taskTitle = tasksById.get(String(session.taskId ?? "")) ?? session.taskTitle ?? "";
      const branch = session.worktreeBranch ?? "";
      return `${taskTitle} ${branch}`.toLowerCase().includes(searchTerm);
    });
  }, [filters.runtimeMode, filters.search, filters.status, sortedSessions, tasksById]);

  const activeCount = sortedSessions.filter((session) => !isTerminalStatus(session.status)).length;
  const filteredActiveCount = filteredSessions.filter(
    (session) => !isTerminalStatus(session.status),
  ).length;

  const idleSessions = useMemo(() => {
    return sortedSessions.filter((session) => {
      if (isTerminalStatus(session.status)) return false;
      return (
        session.status === "ready" ||
        session.status === "sleeping" ||
        session.runtimeMode === "idle"
      );
    });
  }, [sortedSessions]);

  const terminalSessions = useMemo(() => {
    return sortedSessions.filter((session) => isCompletedCleanupStatus(session.status));
  }, [sortedSessions]);

  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface-default">
      <button
        onClick={() => onToggleCollapsed(program._id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover"
      >
        <div>
          <h2 className="text-sm font-semibold text-text-heading">{program.name}</h2>
          <p className="text-xs text-text-secondary">
            {program.clientName ? `${program.clientName} · ` : ""}
            {hasActiveFilters
              ? `${filteredActiveCount} active / ${filteredSessions.length} shown (${sortedSessions.length} total)`
              : `${activeCount} active / ${sortedSessions.length} total`}
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-text-muted transition-transform ${isCollapsed ? "" : "rotate-180"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed ? (
        <div className="border-t border-border-default">
          {sessions !== undefined &&
          sortedSessions.length > 0 &&
          (idleSessions.length > 0 || terminalSessions.length > 0) ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border-default px-4 py-2">
              <span className="type-caption text-text-muted">Program actions</span>
              <button
                onClick={() => onBulkTerminateIdle(idleSessions)}
                disabled={bulkPending !== null || idleSessions.length === 0}
                className="btn-danger btn-sm"
              >
                {`Terminate idle (${idleSessions.length})`}
              </button>
              <button
                onClick={() => onBulkDelete(terminalSessions)}
                disabled={bulkPending !== null || terminalSessions.length === 0}
                className="btn-danger btn-sm"
              >
                {`Delete completed (${terminalSessions.length})`}
              </button>
            </div>
          ) : null}
          {sessions === undefined ? (
            <div className="px-4 py-6 text-sm text-text-secondary">Loading sandbox sessions...</div>
          ) : sortedSessions.length === 0 ? (
            <div className="px-4 py-6 text-sm text-text-secondary">
              No sandbox sessions for this program yet.
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-4 py-6 text-sm text-text-secondary">
              No sandbox sessions match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-default type-caption text-text-muted">
                    <th className="px-4 py-2 font-semibold">Task</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold">Runtime</th>
                    <th className="px-4 py-2 font-semibold">Last Activity</th>
                    <th className="px-4 py-2 font-semibold">TTL</th>
                    <th className="px-4 py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const taskTitle =
                      tasksById.get(String(session.taskId ?? "")) ??
                      session.taskTitle ??
                      "Untitled Task";
                    const taskHref = session.taskId
                      ? `/${program._id}/tasks/${session.taskId}`
                      : null;
                    const pending = pendingBySession[session._id];
                    const terminal = isTerminalStatus(session.status);
                    const pinned = effectivePins[session._id] ?? Boolean(session.isPinned);

                    return (
                      <tr
                        key={session._id}
                        className="border-b border-border-default last:border-b-0 hover:bg-interactive-hover"
                      >
                        <td className="max-w-[260px] px-4 py-2">
                          <div className="min-w-0">
                            {taskHref ? (
                              <Link
                                href={taskHref}
                                className="block truncate text-sm font-semibold text-text-heading hover:text-accent-default"
                              >
                                {taskTitle}
                              </Link>
                            ) : (
                              <span className="block truncate text-sm font-semibold text-text-heading">
                                {taskTitle}
                              </span>
                            )}
                            <span className="block truncate type-code text-text-secondary">
                              {session.worktreeBranch ?? "branch: pending"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <SandboxStatusBadge
                            status={session.status}
                            runtimeMode={session.runtimeMode}
                            setupProgress={session.setupProgress}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {session.runtimeMode ? (
                            <RuntimeModeBadge mode={session.runtimeMode} />
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-text-primary">
                          {formatTimeAgo(getLastActivityTimestamp(session))}
                        </td>
                        <td className="px-4 py-2 text-xs text-text-primary">
                          {getTtlRemainingLabel(session)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                onConnect(session, taskTitle, program.slug ?? program._id)
                              }
                              disabled={terminal || !!pending}
                              className="btn-primary btn-sm"
                            >
                              {pending === "connecting" ? "..." : "Connect"}
                            </button>
                            <button
                              onClick={() => onTogglePin(session)}
                              disabled={!!pending}
                              className="rounded-lg border border-border-default bg-surface-default px-2 py-0.5 text-xs font-medium text-text-primary transition-colors hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {pending === "pinning" ? "..." : pinned ? "Unpin" : "Pin"}
                            </button>
                            <button
                              onClick={() => onTerminate(session._id)}
                              disabled={terminal || !!pending}
                              className="btn-danger btn-sm"
                            >
                              {pending === "terminating" ? "..." : "End"}
                            </button>
                            <button
                              onClick={() => onDelete(session._id)}
                              disabled={!terminal || !!pending}
                              className="btn-danger btn-sm"
                            >
                              {pending === "deleting" ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function SandboxManagerPage() {
  const { organization } = useOrganization();
  const { openTab, focusTab, setExpanded } = useSandboxHUD();
  const { ConfirmModal } = useSandboxSurfaceComponents();
  const convex = useConvex();

  const wakeSession = useMutation("sandbox/sessions:wake" as any);
  const shutdownSession = useAction("sandbox/orchestrator:shutdown" as any);
  const deleteSessionMutation = useMutation("sandbox/sessions:deleteSession" as any);
  const bulkDeleteSessionsMutation = useMutation("sandbox/sessions:bulkDeleteSessions" as any);

  const orgId = organization?.id;
  const programs = useQuery("programs:list" as any, orgId ? { orgId: orgId as any } : "skip") as
    | ProgramLite[]
    | undefined;
  const orgSessions = useQuery(
    "sandbox/sessions:listByOrg" as any,
    orgId ? { orgId: orgId as any } : "skip",
  ) as SandboxSessionLite[] | undefined;

  const [collapsedByProgram, setCollapsedByProgram] = useState<Record<string, boolean>>({});
  const [localPins, setLocalPins] = useState<Record<string, boolean>>({});
  const [pendingBySession, setPendingBySession] = useState<
    Record<string, PendingAction | undefined>
  >({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [bulkPending, setBulkPending] = useState<BulkAction | null>(null);
  const [filters, setFilters] = useState<SandboxManagerFilters>({
    status: "all",
    runtimeMode: "all",
    search: "",
  });
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const sortedPrograms = useMemo(() => {
    return [...(programs ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [programs]);

  const hasActiveFilters =
    filters.status !== "all" || filters.runtimeMode !== "all" || filters.search.trim() !== "";

  const statusFilterOptions = useMemo(() => {
    const values = new Set<string>(STATUS_FILTER_DEFAULTS);
    for (const session of orgSessions ?? []) {
      values.add(session.status);
    }
    return [...values].sort((a, b) => {
      const aOrder = STATUS_ORDER[a] ?? 999;
      const bOrder = STATUS_ORDER[b] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });
  }, [orgSessions]);

  const runtimeModeFilterOptions = useMemo(() => {
    const values = new Set<string>(RUNTIME_MODE_FILTER_DEFAULTS);
    for (const session of orgSessions ?? []) {
      if (session.runtimeMode) {
        values.add(session.runtimeMode);
      }
    }
    return [...values].sort((a, b) => {
      const aOrder = RUNTIME_MODE_ORDER[a] ?? 999;
      const bOrder = RUNTIME_MODE_ORDER[b] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });
  }, [orgSessions]);

  const idleTerminationTargets = useMemo(() => {
    return (orgSessions ?? []).filter((session) => {
      if (isTerminalStatus(session.status)) return false;
      return (
        session.status === "ready" ||
        session.status === "sleeping" ||
        session.runtimeMode === "idle"
      );
    });
  }, [orgSessions]);

  const terminalDeleteTargets = useMemo(() => {
    return (orgSessions ?? []).filter((session) => isCompletedCleanupStatus(session.status));
  }, [orgSessions]);

  const noticeClassName = notice
    ? notice.tone === "success"
      ? "border-status-success-border bg-status-success-bg text-status-success-fg"
      : notice.tone === "error"
        ? "border-status-error-border bg-status-error-bg text-status-error-fg"
        : notice.tone === "info"
          ? "border-status-info-border bg-status-info-bg text-status-info-fg"
          : "border-status-warning-border bg-status-warning-bg text-status-warning-fg"
    : "";

  function setPending(sessionId: string, state?: PendingAction) {
    setPendingBySession((current) => ({ ...current, [sessionId]: state }));
  }

  async function handleConnect(
    session: SandboxSessionLite,
    taskTitle: string,
    programSlug: string,
  ) {
    setNotice(null);
    setPending(session._id, "connecting");
    try {
      if (session.status === "sleeping") {
        try {
          await wakeSession({ sessionId: session._id as any });
        } catch {
          // Keep connect flow resilient — HUD still opens for log visibility.
        }
      }

      openTab({
        sessionId: session._id,
        taskId: String(session.taskId ?? "unknown-task"),
        programSlug,
        taskTitle,
        status: session.status,
        setupProgress: session.setupProgress,
        runtimeMode: session.runtimeMode ?? null,
      });
      focusTab(session._id);
      setExpanded(true);
    } finally {
      setPending(session._id, undefined);
    }
  }

  async function handleTogglePin(session: SandboxSessionLite) {
    setNotice(null);
    setPending(session._id, "pinning");
    try {
      const currentPinned = localPins[session._id] ?? Boolean(session.isPinned);
      const nextPinned = !currentPinned;
      const persisted = await tryPinMutation(convex, session._id, nextPinned);
      setLocalPins((current) => ({ ...current, [session._id]: nextPinned }));

      if (!persisted) {
        setNotice({
          tone: "info",
          message:
            "Pin API is not available in this environment yet. Pin state is shown locally for now.",
        });
      }
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: safeErrorMessage(error, "Failed to update pin state."),
      });
    } finally {
      setPending(session._id, undefined);
    }
  }

  async function handleTerminate(sessionId: string) {
    setNotice(null);
    setPending(sessionId, "terminating");
    try {
      await shutdownSession({ sessionId: sessionId as any });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: safeErrorMessage(error, "Failed to terminate sandbox."),
      });
    } finally {
      setPending(sessionId, undefined);
    }
  }

  function handleDelete(sessionId: string) {
    setConfirmModal({
      title: "Delete sandbox session",
      description:
        "Permanently delete this sandbox session and all its logs/messages? This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmModal(null);
        setNotice(null);
        setPending(sessionId, "deleting");
        try {
          await deleteSessionMutation({ sessionId: sessionId as any });
          setNotice({ tone: "success", message: "Sandbox session scheduled for deletion." });
        } catch (error: unknown) {
          setNotice({
            tone: "error",
            message: safeErrorMessage(error, "Failed to delete sandbox."),
          });
        } finally {
          setPending(sessionId, undefined);
        }
      },
    });
  }

  function handleBulkDelete(targets?: SandboxSessionLite[]) {
    const sessions = targets ?? terminalDeleteTargets;
    if (sessions.length === 0) {
      setNotice({ tone: "info", message: "No completed/failed/cancelled sandboxes to delete." });
      return;
    }

    setConfirmModal({
      title: `Delete ${sessions.length} sandbox session${sessions.length === 1 ? "" : "s"}`,
      description: `Permanently delete ${sessions.length} sandbox session${sessions.length === 1 ? "" : "s"} and all associated logs/messages? This cannot be undone.`,
      confirmLabel: "Delete all",
      onConfirm: async () => {
        setConfirmModal(null);
        setNotice(null);
        setBulkPending("deleteCompleted");

        try {
          let totalDeleted = 0;
          let totalSkipped = 0;
          const ids = sessions.map((s) => s._id);

          for (let i = 0; i < ids.length; i += 50) {
            const batch = ids.slice(i, i + 50);
            const result = await bulkDeleteSessionsMutation({ sessionIds: batch as any });
            totalDeleted += result.deleted;
            totalSkipped += result.skipped;
          }

          const noun = totalDeleted === 1 ? "sandbox" : "sandboxes";
          const msg =
            totalSkipped > 0
              ? `Scheduled ${totalDeleted} ${noun} for deletion, skipped ${totalSkipped}.`
              : `Scheduled ${totalDeleted} ${noun} for deletion.`;
          setNotice({ tone: "success", message: msg });
        } catch (error: unknown) {
          setNotice({
            tone: "error",
            message: safeErrorMessage(error, "Failed to bulk delete sandboxes."),
          });
        } finally {
          setBulkPending(null);
        }
      },
    });
  }

  function clearPendingForSessionIds(sessionIds: string[]) {
    setPendingBySession((current) => {
      const next = { ...current };
      for (const sessionId of sessionIds) {
        if (next[sessionId] === "terminating") {
          next[sessionId] = undefined;
        }
      }
      return next;
    });
  }

  async function runBulkShutdown(
    action: BulkAction,
    targetLabel: string,
    candidates: SandboxSessionLite[],
  ) {
    setNotice(null);
    const sessionIds = candidates
      .map((session) => session._id)
      .filter((sessionId) => pendingBySession[sessionId] === undefined);

    if (sessionIds.length === 0) {
      setNotice({
        tone: "info",
        message:
          candidates.length === 0
            ? `No ${targetLabel} sandboxes to process.`
            : `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)} sandboxes are already being processed.`,
      });
      return;
    }

    setBulkPending(action);
    setPendingBySession((current) => {
      const next = { ...current };
      for (const sessionId of sessionIds) {
        next[sessionId] = "terminating";
      }
      return next;
    });

    try {
      const results = await Promise.allSettled(
        sessionIds.map((sessionId) => shutdownSession({ sessionId: sessionId as any })),
      );
      const failedResults = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const successCount = results.length - failedResults.length;
      const noun = successCount === 1 ? "sandbox" : "sandboxes";

      if (failedResults.length === 0) {
        setNotice({
          tone: "success",
          message: `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)}: ${successCount} ${noun} processed.`,
        });
      } else {
        const firstError = failedResults[0]?.reason;
        const firstErrorMessage =
          firstError instanceof Error
            ? firstError.message
            : typeof firstError === "string"
              ? firstError
              : "Unknown error";
        setNotice({
          tone: "error",
          message: `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)}: ${successCount} processed, ${failedResults.length} failed (${firstErrorMessage}).`,
        });
      }
    } finally {
      clearPendingForSessionIds(sessionIds);
      setBulkPending(null);
    }
  }

  function toggleProgram(programId: string) {
    setCollapsedByProgram((current) => ({
      ...current,
      [programId]: current[programId] === false,
    }));
  }

  function clearFilters() {
    setFilters({
      status: "all",
      runtimeMode: "all",
      search: "",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="type-display-m text-text-heading">Sandbox Manager</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Active and recent sandboxes grouped by program.
          </p>
        </div>
        <Link
          href="/sandboxes/settings"
          className="rounded-lg border border-border-default bg-surface-default px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-interactive-hover"
        >
          Sandbox Settings
        </Link>
      </div>

      {notice ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${noticeClassName}`}>
          {notice.message}
        </div>
      ) : null}

      <section className="rounded-xl border border-border-default bg-surface-default p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="type-caption text-text-muted">Search task/branch</span>
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Search task title or branch..."
              className="input"
            />
          </label>
          <label className="space-y-1">
            <span className="type-caption text-text-muted">Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className="select"
            >
              <option value="all">All statuses</option>
              {statusFilterOptions.map((status) => (
                <option key={status} value={status}>
                  {formatTokenLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="type-caption text-text-muted">Runtime mode</span>
            <select
              value={filters.runtimeMode}
              onChange={(event) =>
                setFilters((current) => ({ ...current, runtimeMode: event.target.value }))
              }
              className="select"
            >
              <option value="all">All runtime modes</option>
              {runtimeModeFilterOptions.map((runtimeMode) => (
                <option key={runtimeMode} value={runtimeMode}>
                  {formatTokenLabel(runtimeMode)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-text-secondary">
            Filter sandboxes by state and quickly find a task branch.
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-border-default bg-surface-default px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-interactive-hover"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border-default bg-surface-default p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-caption text-text-muted">Bulk actions</span>
          <button
            onClick={() =>
              runBulkShutdown("terminateIdle", "terminate idle", idleTerminationTargets)
            }
            disabled={
              bulkPending !== null ||
              orgSessions === undefined ||
              idleTerminationTargets.length === 0
            }
            className="btn-danger btn-sm"
          >
            {bulkPending === "terminateIdle"
              ? "Terminating..."
              : `Terminate idle (${idleTerminationTargets.length})`}
          </button>
          <button
            onClick={() => handleBulkDelete()}
            disabled={
              bulkPending !== null ||
              orgSessions === undefined ||
              terminalDeleteTargets.length === 0
            }
            className="btn-danger btn-sm"
          >
            {bulkPending === "deleteCompleted"
              ? "Deleting..."
              : `Delete completed (${terminalDeleteTargets.length})`}
          </button>
        </div>
      </section>

      {programs === undefined ? (
        <div className="rounded-xl border border-border-default bg-surface-default p-6 text-sm text-text-secondary">
          Loading sandbox manager...
        </div>
      ) : sortedPrograms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface-default p-8 text-center">
          <p className="text-sm text-text-secondary">
            No programs available for this organization.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPrograms.map((program) => (
            <SandboxProgramGroup
              key={program._id}
              program={program}
              isCollapsed={collapsedByProgram[program._id] !== false}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              effectivePins={localPins}
              pendingBySession={pendingBySession}
              bulkPending={bulkPending}
              onToggleCollapsed={toggleProgram}
              onConnect={handleConnect}
              onTogglePin={handleTogglePin}
              onTerminate={handleTerminate}
              onDelete={handleDelete}
              onBulkTerminateIdle={(sessions) =>
                runBulkShutdown("terminateIdle", "terminate idle", sessions)
              }
              onBulkDelete={(sessions) => handleBulkDelete(sessions)}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        title={confirmModal?.title ?? ""}
        description={confirmModal?.description ?? ""}
        confirmLabel={confirmModal?.confirmLabel ?? "Confirm"}
        tone="danger"
      />
    </div>
  );
}
