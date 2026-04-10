"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type FileChangeSummary, SandboxFileChanges } from "./SandboxFileChanges";
import { SandboxStatusBadge } from "./SandboxStatusBadge";
import { SandboxTerminal } from "./SandboxTerminal";

interface SandboxSession {
  _id: string;
  status: string;
  setupProgress?: unknown;
  runtimeMode?: string | null;
  repositoryId?: string | null;
  skillId?: string | null;
  taskPrompt?: string | null;
  prUrl?: string | null;
  worktreeBranch?: string | null;
  commitSha?: string | null;
  filesChanged?: number | null;
  error?: string | null;
}

interface SandboxLogEntry {
  _id?: string;
  timestamp?: number | string;
  level?: string;
  message?: unknown;
  metadata?: {
    fileChange?: { type: string; path: string };
    fileChangeSummary?: FileChangeSummary;
  };
}

interface SandboxLogStreamProps {
  sessionId: string;
  onRestart?: (session: SandboxSession) => void;
  onRestartNow?: (session: SandboxSession) => void;
  isRestartingNow?: boolean;
  restartNowError?: string | null;
  showTerminal?: boolean;
}

const LOG_COLOR: Record<string, string> = {
  stdout: "text-comp-terminal-value",
  stderr: "text-status-error-fg",
  system: "text-comp-terminal-agent",
  info: "text-comp-terminal-text",
  error: "text-status-error-fg",
};

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatTimestamp(value?: number | string) {
  const timestamp = parseTimestamp(value);
  if (timestamp == null) return "--:--:--";
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toLogs(raw: unknown): SandboxLogEntry[] {
  if (Array.isArray(raw)) return raw as SandboxLogEntry[];
  if (!raw || typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.logs)) return record.logs as SandboxLogEntry[];
  if (Array.isArray(record.results)) return record.results as SandboxLogEntry[];
  if (Array.isArray(record.page)) return record.page as SandboxLogEntry[];
  return [];
}

function safeDisplayValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    const serialized = JSON.stringify(value);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall back below.
  }
  try {
    return Object.prototype.toString.call(value);
  } catch {
    return "";
  }
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    const normalized = safeDisplayValue(message).trim();
    if (normalized) return normalized;
  }
  const normalized = safeDisplayValue(error).trim();
  return normalized || fallback;
}

export function SandboxLogStream({
  sessionId,
  onRestart,
  onRestartNow,
  isRestartingNow = false,
  restartNowError = null,
  showTerminal = true,
}: SandboxLogStreamProps) {
  const session = useQuery(
    "sandbox/sessions:get" as any,
    sessionId ? { sessionId: sessionId as any } : "skip",
  ) as SandboxSession | null | undefined;

  const rawLogs = useQuery(
    "sandbox/logs:listBySession" as any,
    sessionId ? { sessionId: sessionId as any } : "skip",
  );

  const stopSession = useAction("sandbox/orchestrator:stop" as any);

  const [isStopping, setIsStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const logsViewportRef = useRef<HTMLDivElement>(null);

  const logs = useMemo(() => toLogs(rawLogs), [rawLogs]);

  const fileChangeSummary = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i--) {
      const summary = logs[i].metadata?.fileChangeSummary;
      if (summary) return summary;
    }
    return null;
  }, [logs]);

  const liveFileChanges = useMemo<FileChangeSummary | null>(() => {
    if (fileChangeSummary) return null; // Full summary available, skip live view
    const fileMap = new Map<string, string>();
    for (const entry of logs) {
      const fc = entry.metadata?.fileChange;
      if (fc?.path) {
        fileMap.set(fc.path, fc.type);
      }
    }
    if (fileMap.size === 0) return null;
    const files = Array.from(fileMap, ([path, status]) => ({
      path,
      status:
        status === "A" || status === "create"
          ? "A"
          : status === "D" || status === "delete"
            ? "D"
            : "M",
    }));
    return { files, diffs: {}, totalFiles: files.length };
  }, [logs, fileChangeSummary]);

  const status = session?.status ?? "provisioning";
  const canCancel = !["completed", "failed", "cancelled"].includes(status);
  const isActive = ["ready", "executing", "cloning"].includes(status);
  const canRestart = status === "failed" && Boolean(onRestart);
  const canRestartNow = status === "failed" && Boolean(onRestartNow);
  const canRestartNowWithCurrentSession = canRestartNow && Boolean(session?.repositoryId);

  useEffect(() => {
    const node = logsViewportRef.current;
    if (!node || !stickToBottom) return;
    if (typeof node.scrollTo === "function") {
      node.scrollTo({ top: node.scrollHeight });
    } else {
      node.scrollTop = node.scrollHeight;
    }
  }, [logs.length, stickToBottom]);

  function handleViewportScroll() {
    const node = logsViewportRef.current;
    if (!node) return;
    const fromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setStickToBottom(fromBottom < 24);
  }

  async function handleStop() {
    if (!session?._id || !canCancel) return;
    setIsStopping(true);
    setStopError(null);
    try {
      await stopSession({
        sessionId: session._id as any,
      } as any);
    } catch (err: unknown) {
      setStopError(safeErrorMessage(err, "Failed to stop sandbox session."));
    } finally {
      setIsStopping(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-heading">Sandbox Session</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Live execution output from the assigned agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session?.worktreeBranch && (
            <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-secondary">
              {session.worktreeBranch}
            </span>
          )}
          <SandboxStatusBadge
            status={status}
            prUrl={session?.prUrl ?? null}
            runtimeMode={session?.runtimeMode}
            setupProgress={session?.setupProgress}
          />
          {canRestartNow && session ? (
            <button
              onClick={() => onRestartNow?.(session)}
              disabled={!canRestartNowWithCurrentSession || isRestartingNow}
              title={
                canRestartNowWithCurrentSession
                  ? undefined
                  : "Repository context missing for this failed session."
              }
              className="rounded-lg border border-status-warning-border bg-surface-default px-2.5 py-1 text-xs font-medium text-status-warning-fg transition-colors hover:bg-status-warning-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRestartingNow ? "Restarting..." : "Restart Now"}
            </button>
          ) : null}
          {canRestart && session ? (
            <button
              onClick={() => onRestart?.(session)}
              className="rounded-lg border border-status-warning-border bg-surface-default px-2.5 py-1 text-xs font-medium text-status-warning-fg transition-colors hover:bg-status-warning-bg"
            >
              Restart Implementation
            </button>
          ) : null}
          {canCancel ? (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="rounded-lg border border-status-error-border bg-surface-default px-2.5 py-1 text-xs font-medium text-status-error-fg transition-colors hover:bg-status-error-bg disabled:opacity-50"
            >
              {isStopping ? "Stopping..." : "Stop"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={logsViewportRef}
        onScroll={handleViewportScroll}
        className="h-80 overflow-y-auto rounded-lg border border-comp-terminal-border bg-comp-terminal-bg p-3 font-mono text-xs"
        aria-live="polite"
      >
        {rawLogs === undefined ? (
          <p className="text-comp-terminal-text">Connecting to sandbox log stream...</p>
        ) : logs.length === 0 ? (
          <p className="text-comp-terminal-text">Waiting for execution logs...</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((entry, index) => {
              const level = entry.level ?? "info";
              const fileChange = entry.metadata?.fileChange;
              const parsedTimestamp = parseTimestamp(entry.timestamp);
              let textColor = LOG_COLOR[level] ?? "text-comp-terminal-value";
              let prefix = "";
              if (fileChange) {
                if (fileChange.type === "A") {
                  textColor = "text-comp-terminal-success";
                  prefix = "\u{1F4C4} ";
                } else if (fileChange.type === "M") {
                  textColor = "text-comp-terminal-agent";
                  prefix = "\u{1F4DD} ";
                } else if (fileChange.type === "D") {
                  textColor = "text-status-error-fg";
                  prefix = "\u{1F5D1} ";
                }
              }
              return (
                <div key={entry._id ?? `t-${parsedTimestamp ?? index}-${index}`}>
                  <span className="text-comp-terminal-timestamp">
                    [{formatTimestamp(entry.timestamp)}]
                  </span>
                  <span className="mx-2 text-comp-terminal-text">{level.toUpperCase()}</span>
                  <span className={textColor}>
                    {prefix}
                    {safeDisplayValue(entry.message)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!stickToBottom && logs.length > 0 ? (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => setStickToBottom(true)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-accent-default transition-colors hover:bg-interactive-hover"
          >
            Jump to latest
          </button>
        </div>
      ) : null}

      {showTerminal && isActive && sessionId && <SandboxTerminal sessionId={sessionId} />}

      {fileChangeSummary ? (
        <SandboxFileChanges fileChangeSummary={fileChangeSummary} mode="complete" />
      ) : liveFileChanges ? (
        <SandboxFileChanges fileChangeSummary={liveFileChanges} mode="live" />
      ) : null}

      {status === "completed" && session && (session.commitSha || session.filesChanged != null) ? (
        <div className="mt-3 rounded-lg border border-status-success-border bg-status-success-bg px-3 py-2.5">
          <p className="mb-1 text-xs font-medium text-status-success-fg">Execution Complete</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-status-success-fg">
            {session.commitSha && (
              <span>
                Commit{" "}
                <code className="rounded bg-status-success-bg px-1 py-0.5 font-mono">
                  {session.commitSha.slice(0, 7)}
                </code>
              </span>
            )}
            {session.filesChanged != null && (
              <span>
                {session.filesChanged} file{session.filesChanged !== 1 ? "s" : ""} changed
              </span>
            )}
            {session.worktreeBranch && (
              <span>
                on{" "}
                <code className="rounded bg-status-success-bg px-1 py-0.5 font-mono">
                  {session.worktreeBranch}
                </code>
              </span>
            )}
            {session.prUrl && (
              <a
                href={session.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-status-success-fg underline hover:opacity-80"
              >
                View PR
              </a>
            )}
          </div>
        </div>
      ) : null}

      {session?.error ? (
        <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          {session.error}
        </div>
      ) : null}

      {stopError ? (
        <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          {stopError}
        </div>
      ) : null}

      {restartNowError ? (
        <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          {restartNowError}
        </div>
      ) : null}
    </div>
  );
}
