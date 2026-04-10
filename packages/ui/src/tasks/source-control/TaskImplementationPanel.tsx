"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityFeedSection } from "./ActivityFeedSection";
import { ChangedFilesSection } from "./ChangedFilesSection";
import { CommitsSection } from "./CommitsSection";
import { HeroPRCard } from "./HeroPRCard";
import { PreviousPRsSection } from "./PreviousPRsSection";

interface TaskImplementationPanelProps {
  taskId: string;
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (message && typeof message === "object") {
      try {
        const serialized = JSON.stringify(message);
        if (serialized && serialized !== "{}") {
          return serialized;
        }
      } catch {
        // fall through to fallback
      }
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function resolveDisplayText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Fall through to fallback.
    }
  }
  return fallback;
}

function logTaskImplementation(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>,
) {
  const prefix = `[TaskImplementationPanel] ${message}`;
  try {
    if (level === "error") {
      if (details) {
        console.error(prefix, details);
      } else {
        console.error(prefix);
      }
      return;
    }
    if (level === "warn") {
      if (details) {
        console.warn(prefix, details);
      } else {
        console.warn(prefix);
      }
      return;
    }
    if (details) {
      console.info(prefix, details);
    } else {
      console.info(prefix);
    }
  } catch {
    // Logging must never break UI.
  }
}

function GitMergeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v12M18 9a9 9 0 01-9 9" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

// ─── Branch Files Section (pre-PR) ──────────────────────────────────────────

interface BranchFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

const FILE_STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  added: { label: "A", classes: "bg-status-success-bg text-status-success-fg" },
  modified: { label: "M", classes: "bg-status-warning-bg text-status-warning-fg" },
  removed: { label: "D", classes: "bg-status-error-bg text-status-error-fg" },
  renamed: { label: "R", classes: "bg-status-info-bg text-status-info-fg" },
};

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function BranchFilesSection({ taskId }: { taskId: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const [files, setFiles] = useState<BranchFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listBranchFiles = useAction("sourceControl/tasks/prActionsInternal:listBranchFiles" as any);

  const handleToggle = useCallback(async () => {
    if (!collapsed) {
      setCollapsed(true);
      return;
    }
    setCollapsed(false);
    if (files !== null) return;

    if (!listBranchFiles) {
      setError("File listing not available");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listBranchFiles({ taskId });
      const normalized = Array.isArray(result) ? result : [];
      setFiles(normalized);
      logTaskImplementation("info", "Loaded branch file list", {
        taskId,
        fileCount: normalized.length,
      });
    } catch (e: unknown) {
      const message = resolveErrorMessage(e, "Failed to load files");
      setError(message);
      logTaskImplementation("error", "Failed to load branch files", {
        taskId,
        message,
      });
    } finally {
      setLoading(false);
    }
  }, [collapsed, files, listBranchFiles, taskId]);

  const totalAdditions = files?.reduce((s, f) => s + f.additions, 0) ?? 0;
  const totalDeletions = files?.reduce((s, f) => s + f.deletions, 0) ?? 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        {collapsed ? (
          <ChevronRightIcon className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-text-muted" />
        )}
        <span className="text-sm font-semibold text-text-primary">Changed Files</span>
        {files && (
          <span className="text-xs text-text-muted">
            {files.length} file{files.length !== 1 ? "s" : ""}
            {" · "}
            <span className="text-status-success-fg">+{totalAdditions}</span>
            {" / "}
            <span className="text-status-error-fg">-{totalDeletions}</span>
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-border-default px-2 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
              <span className="ml-2 text-xs text-text-secondary">Loading files...</span>
            </div>
          ) : error ? (
            <p className="px-3 py-4 text-xs text-status-error-fg">{error}</p>
          ) : files && files.length > 0 ? (
            <div className="space-y-0.5">
              {files.map((file) => {
                const badge = FILE_STATUS_BADGE[file.status] ?? FILE_STATUS_BADGE.modified;
                return (
                  <div key={file.filename} className="flex items-center gap-2 rounded-lg px-3 py-2">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-primary">
                      {file.filename}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      <span className="text-status-success-fg">+{file.additions}</span>{" "}
                      <span className="text-status-error-fg">-{file.deletions}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : files ? (
            <p className="px-3 py-4 text-xs text-text-muted">No changed files</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function TaskImplementationPanel({ taskId }: TaskImplementationPanelProps) {
  // Hero PR data (for file list + commit data)
  const heroPR = useQuery("sourceControl/tasks/prLifecycle:getActiveHeroPR" as any, { taskId });

  // Branch info — tells us if a branch exists before any PR is created
  const branchInfo = useQuery("sandbox/sessions:getBranchInfoForTask" as any, { taskId });

  // refreshFromGitHub action
  const refreshFromGitHub = useAction(
    "sourceControl/tasks/prActionsInternal:refreshFromGitHub" as any,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // syncBranchActivity action
  const syncBranch = useAction("sourceControl/tasks/prActionsInternal:syncBranchActivity" as any);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Tracks whether a PR is being created asynchronously after sync
  const [prPending, setPrPending] = useState(false);

  // Auto-sync: trigger once on mount when branch exists but no PR yet
  const autoSyncAttempted = useRef(false);

  useEffect(() => {
    if (!autoSyncAttempted.current && heroPR === null && branchInfo?.branchName && syncBranch) {
      autoSyncAttempted.current = true;
      // Auto-sync runs silently — never sets prPending to avoid getting stuck
      // on "Creating draft PR..." across refreshes. Only manual sync shows that state.
      (async () => {
        setSyncing(true);
        try {
          await syncBranch({ taskId });
          logTaskImplementation("info", "Auto-sync completed", { taskId });
        } catch (error) {
          logTaskImplementation("warn", "Auto-sync failed", {
            taskId,
            message: resolveErrorMessage(error, "Auto-sync failed"),
          });
          // Silently fail auto-sync — user can manually retry
        } finally {
          setSyncing(false);
        }
      })();
    }
  }, [heroPR, branchInfo, syncBranch, taskId]);

  // Clear prPending when the reactive query delivers the PR, or after 30s timeout
  useEffect(() => {
    if (prPending && heroPR) {
      setPrPending(false);
    }
  }, [prPending, heroPR]);

  useEffect(() => {
    if (!prPending) return;
    const timer = setTimeout(() => setPrPending(false), 30_000);
    return () => clearTimeout(timer);
  }, [prPending]);

  async function handleRefresh() {
    if (!refreshFromGitHub) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshFromGitHub({ taskId });
      logTaskImplementation("info", "Refresh from GitHub completed", { taskId });
    } catch (e: unknown) {
      const message = resolveErrorMessage(e, "Failed to refresh");
      setRefreshError(message);
      logTaskImplementation("error", "Refresh from GitHub failed", {
        taskId,
        message,
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSyncBranch() {
    if (!syncBranch) return;
    setSyncing(true);
    setSyncResult(null);
    setPrPending(false);
    try {
      const result = await syncBranch({ taskId });
      const status = typeof result?.status === "string" ? result.status : "";
      const syncedCount = parseFiniteNumber(result?.synced) ?? 0;
      const prScheduled = result?.prScheduled === true;

      logTaskImplementation("info", "Sync branch action completed", {
        taskId,
        status: status || "ok",
        syncedCount,
        prScheduled,
      });

      if (status === "no_branch" || status === "branch_not_found") {
        setSyncResult(resolveDisplayText(result?.message, "No branch found"));
      } else if (syncedCount > 0 || prScheduled) {
        if (prScheduled) {
          setPrPending(true);
          setSyncResult(`Synced ${syncedCount} commits`);
        } else {
          setSyncResult(`Synced ${syncedCount} commits`);
        }
      } else {
        setSyncResult("Branch is up to date");
      }
    } catch (e: unknown) {
      const message = resolveErrorMessage(e, "Sync failed");
      setSyncResult(message);
      logTaskImplementation("error", "Sync branch action failed", {
        taskId,
        message,
      });
    } finally {
      setSyncing(false);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (heroPR === undefined) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Implementation</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="h-20 animate-pulse rounded-lg bg-surface-raised" />
            <div className="h-12 animate-pulse rounded-lg bg-surface-raised" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-raised" />
          </div>
        </div>
      </div>
    );
  }

  // ─── PR being created asynchronously ──────────────────────────────────────
  if (prPending && !heroPR) {
    return (
      <div className="rounded-xl border border-status-info-border bg-status-info-bg px-6 py-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-info-bg">
          <GitMergeIcon className="h-6 w-6 animate-pulse text-accent-default" />
        </div>
        <p className="text-sm font-medium text-status-info-fg">Creating draft PR...</p>
        <p className="mt-1 text-xs text-accent-default">
          Generating AI description and opening pull request on GitHub
        </p>
        {syncResult && <p className="mt-2 text-xs text-accent-default/70">{syncResult}</p>}
      </div>
    );
  }

  // ─── Syncing state (auto or manual) ───────────────────────────────────────
  if (syncing && !heroPR) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default px-6 py-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
          <RefreshIcon className="h-6 w-6 animate-spin text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-primary">Scanning branch for commits...</p>
        <p className="mt-1 text-xs text-text-secondary">
          Checking for new activity on the sandbox branch
        </p>
      </div>
    );
  }

  // ─── Empty state — no active PR ────────────────────────────────────────────
  if (heroPR === null) {
    const hasBranch = branchInfo?.branchName;
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-dashed border-border-default bg-surface-default px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
            <GitMergeIcon className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-primary">
            {hasBranch ? "Branch exists — no PR yet" : "No implementation activity yet"}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {hasBranch
              ? "Click Sync Branch to scan for commits and create a draft PR."
              : "A draft PR will be created automatically when you push your first commit from the sandbox."}
          </p>
          <button
            className="btn-primary btn-sm mt-4 mx-auto flex items-center gap-2 disabled:opacity-50"
            onClick={handleSyncBranch}
            disabled={syncing}
          >
            <RefreshIcon className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Scanning..." : "Sync Branch"}
          </button>
          {syncResult && <p className="mt-2 text-xs text-text-secondary">{syncResult}</p>}
        </div>

        {/* Show changed files even without a PR */}
        {hasBranch && <BranchFilesSection taskId={taskId} />}
      </div>
    );
  }

  // ─── Active PR layout ────────────────────────────────────────────────────────
  // Commits from the query (joined from sourceControlCommits table)
  const commits: any[] = Array.isArray(heroPR.commits) ? heroPR.commits : [];
  const filesChangedCount = parseFiniteNumber(heroPR.filesChanged) ?? 0;
  const additionsCount = parseFiniteNumber(heroPR.additions) ?? 0;
  const deletionsCount = parseFiniteNumber(heroPR.deletions) ?? 0;

  return (
    <div className="space-y-3">
      {/* Panel header with Refresh + Sync buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Implementation</h2>
        <div className="flex items-center gap-2">
          {refreshError && <span className="text-xs text-status-error-fg">{refreshError}</span>}
          <button
            onClick={handleSyncBranch}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-interactive-hover disabled:opacity-50"
            title="Sync branch commits"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-interactive-hover disabled:opacity-50"
            title="Refresh from GitHub"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Hero PR Card */}
      <HeroPRCard taskId={taskId} />

      {/* Changed Files — always show when there's a PR with file changes */}
      {filesChangedCount > 0 && (
        <ChangedFilesSection
          prId={heroPR._id}
          filesChanged={filesChangedCount}
          additions={additionsCount}
          deletions={deletionsCount}
        />
      )}

      {/* Commits — from sourceControlCommits table */}
      {commits.length > 0 && <CommitsSection commits={commits} />}

      {/* Activity Feed */}
      <ActivityFeedSection taskId={taskId} />

      {/* Previous / Stacked PRs */}
      <PreviousPRsSection taskId={taskId} activePrId={heroPR._id} />
    </div>
  );
}
