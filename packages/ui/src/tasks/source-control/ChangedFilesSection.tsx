"use client";

import { useAction } from "convex/react";
import { useCallback, useState } from "react";

interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

interface ChangedFilesSectionProps {
  prId: string;
  filesChanged: number;
  additions: number;
  deletions: number;
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

const FILE_STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  added: {
    label: "A",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  modified: {
    label: "M",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  removed: {
    label: "D",
    classes: "bg-status-error-bg text-status-error-fg",
  },
  renamed: {
    label: "R",
    classes: "bg-status-info-bg text-status-info-fg",
  },
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

// --- Individual File Row ----

function FileRow({ file }: { file: ChangedFile }) {
  const [expanded, setExpanded] = useState(false);

  const badge = FILE_STATUS_BADGE[file.status] ?? FILE_STATUS_BADGE.modified;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-interactive-hover"
      >
        {expanded ? (
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        )}
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
      </button>

      {expanded && file.patch && (
        <div className="ml-10 mb-1 overflow-hidden rounded-lg border border-border-default bg-surface-raised">
          <DiffViewer diff={file.patch} />
        </div>
      )}

      {expanded && !file.patch && (
        <div className="ml-10 mb-1 px-3 py-3 text-xs text-text-muted">
          No diff available (file may be binary or too large)
        </div>
      )}
    </div>
  );
}

// --- Diff Viewer ---

function DiffViewer({ diff }: { diff: string }) {
  const lines = diff.split("\n");

  return (
    <div className="overflow-x-auto">
      <pre className="min-w-0 p-3 font-mono text-[11px] leading-5">
        {lines.map((line, i) => {
          let lineClass = "text-text-secondary";
          let bgClass = "";

          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass = "text-status-success-fg";
            bgClass = "bg-status-success-bg";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass = "text-status-error-fg";
            bgClass = "bg-status-error-bg";
          } else if (line.startsWith("@@")) {
            lineClass = "text-accent-default";
            bgClass = "bg-status-info-bg";
          } else if (
            line.startsWith("diff ") ||
            line.startsWith("index ") ||
            line.startsWith("---") ||
            line.startsWith("+++")
          ) {
            lineClass = "text-text-secondary";
          }

          return (
            <div key={i} className={`-mx-3 px-3 ${bgClass}`}>
              <span className={lineClass}>{line || " "}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// --- Main Section -- lazy-fetches file list from GitHub on expand ---

export function ChangedFilesSection({
  prId,
  filesChanged,
  additions,
  deletions,
}: ChangedFilesSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [files, setFiles] = useState<ChangedFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPRFiles = useAction("sourceControl/tasks/prActionsInternal:listPRFiles" as any);

  const handleToggle = useCallback(async () => {
    if (!collapsed) {
      setCollapsed(true);
      return;
    }
    setCollapsed(false);
    if (files !== null) return; // already loaded

    if (!listPRFiles) {
      setError("File listing not available yet");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listPRFiles({ prId });
      setFiles(result);
    } catch (e: unknown) {
      setError(safeErrorMessage(e, "Failed to load files"));
    } finally {
      setLoading(false);
    }
  }, [collapsed, files, listPRFiles, prId]);

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
        <span className="text-xs text-text-muted">
          {filesChanged} file{filesChanged !== 1 ? "s" : ""}
          {" · "}
          <span className="text-status-success-fg">+{additions}</span>
          {" / "}
          <span className="text-status-error-fg">-{deletions}</span>
        </span>
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
              {files.map((file) => (
                <FileRow key={file.filename} file={file} />
              ))}
            </div>
          ) : files ? (
            <p className="px-3 py-4 text-xs text-text-muted">No changed files</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
