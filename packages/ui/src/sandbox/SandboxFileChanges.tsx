"use client";

import { useState } from "react";

export interface FileChangeSummary {
  files: Array<{ status: string; path: string }>;
  diffs: Record<string, string>;
  totalFiles: number;
}

interface SandboxFileChangesProps {
  fileChangeSummary: FileChangeSummary;
  mode?: "live" | "complete";
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  A: {
    label: "A",
    className: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  },
  M: {
    label: "M",
    className: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  },
  D: {
    label: "D",
    className: "bg-status-error-bg text-status-error-fg border border-status-error-border",
  },
};

function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <div className="border-t border-comp-terminal-border bg-comp-terminal-bg px-3 py-2 text-xs">
      {lines.map((line, i) => {
        let className = "text-comp-terminal-text";
        let bg = "";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          className = "text-status-success-fg";
          bg = "bg-status-success-bg";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          className = "text-status-error-fg";
          bg = "bg-status-error-bg";
        } else if (line.startsWith("@@")) {
          className = "text-comp-terminal-agent";
        }
        return (
          <div key={i} className={`whitespace-pre font-mono ${className} ${bg}`}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}

export function SandboxFileChanges({
  fileChangeSummary,
  mode = "complete",
}: SandboxFileChangesProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const { files, diffs, totalFiles } = fileChangeSummary;
  const isLive = mode === "live";

  function toggleFile(path: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-border-default bg-surface-default font-mono text-xs">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-text-primary transition-colors hover:bg-interactive-hover"
      >
        <span className="font-semibold">
          {isLive ? "Files Touched" : "Files Changed"}{" "}
          <span className="font-normal text-text-secondary">
            ({totalFiles} file{totalFiles !== 1 ? "s" : ""})
          </span>
          {isLive && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-status-success-fg" />
          )}
        </span>
        <span className="text-text-muted">{collapsed ? "+" : "\u2212"}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-border-default">
          {files.map((file) => {
            const badge = STATUS_BADGE[file.status] ?? STATUS_BADGE.M;
            const hasDiff = !isLive && Boolean(diffs[file.path]);
            const isExpanded = expandedFiles.has(file.path);

            return (
              <div key={file.path}>
                <button
                  onClick={() => hasDiff && toggleFile(file.path)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    hasDiff ? "cursor-pointer hover:bg-interactive-hover" : "cursor-default"
                  } ${isExpanded ? "bg-interactive-subtle" : ""}`}
                >
                  <span
                    className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="truncate text-text-primary">{file.path}</span>
                  {hasDiff && (
                    <span className="ml-auto flex-shrink-0 text-text-muted">
                      {isExpanded ? "\u25BC" : "\u25B6"}
                    </span>
                  )}
                </button>
                {isExpanded && diffs[file.path] && <DiffView diff={diffs[file.path]} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
