"use client";

import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  FolderOpen,
  GitCommit,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Subtask = {
  _id: Id<"subtasks">;
  title: string;
  description: string;
  prompt: string;
  estimatedFiles: number;
  complexityScore: number;
  estimatedDurationMs: number;
  allowedFiles?: string[];
  order: number;
  isPausePoint: boolean;
  status: string;
  commitSha?: string;
  filesChanged?: string[];
  scopeViolations?: string[];
  executionDurationMs?: number;
  errorMessage?: string;
};

type TabId = "prompt" | "files" | "diff" | "logs";

interface SubtaskDetailTabsProps {
  subtask: Subtask;
}

export function SubtaskDetailTabs({ subtask }: SubtaskDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("prompt");
  const [copied, setCopied] = useState(false);

  const tabs: { id: TabId; label: string; icon: React.ReactNode; available: boolean }[] = [
    { id: "prompt", label: "Prompt", icon: <FileText className="h-3 w-3" />, available: true },
    { id: "files", label: "Files", icon: <FolderOpen className="h-3 w-3" />, available: true },
    {
      id: "diff",
      label: "Diff",
      icon: <GitCommit className="h-3 w-3" />,
      available: !!subtask.commitSha,
    },
    {
      id: "logs",
      label: "Logs",
      icon: <Terminal className="h-3 w-3" />,
      available: subtask.status !== "pending",
    },
  ];

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(subtask.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-border-default px-3 pb-3 pt-2">
      {/* Sizing metadata */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
        <span>Est. Files: {subtask.estimatedFiles}</span>
        <span>Complexity: {subtask.complexityScore}/5</span>
        <span>Est. Time: ~{Math.round(subtask.estimatedDurationMs / 60000)} min</span>
        {subtask.executionDurationMs && (
          <span className="text-status-success-fg">
            Actual: {Math.round(subtask.executionDurationMs / 1000)}s
          </span>
        )}
      </div>

      {/* Description */}
      {subtask.description && (
        <p className="mb-2 text-xs text-text-secondary">{subtask.description}</p>
      )}

      {/* Tab bar */}
      <div className="mb-2 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.available && setActiveTab(tab.id)}
            disabled={!tab.available}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              activeTab === tab.id
                ? "bg-status-info-bg text-accent-default"
                : tab.available
                  ? "text-text-secondary hover:bg-interactive-hover"
                  : "cursor-not-allowed text-text-muted"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "prompt" && (
        <div className="relative">
          <pre className="h-full overflow-auto rounded-lg bg-surface-raised p-3 text-sm text-text-primary">
            {subtask.prompt || "No prompt generated yet."}
          </pre>
          {subtask.prompt && (
            <button
              onClick={handleCopyPrompt}
              className="absolute right-2 top-2 rounded p-1 text-text-muted hover:bg-surface-elevated hover:text-text-secondary"
              title="Copy prompt"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-status-success-fg" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {activeTab === "files" && (
        <div className="space-y-2">
          {/* Allowed files */}
          {subtask.allowedFiles && subtask.allowedFiles.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase text-text-muted">
                Allowed Files
              </p>
              <div className="space-y-0.5">
                {subtask.allowedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="rounded bg-surface-raised px-2 py-0.5 font-mono text-xs text-text-secondary"
                  >
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Changed files (after execution) */}
          {subtask.filesChanged && subtask.filesChanged.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase text-text-muted">
                Files Changed
              </p>
              <div className="space-y-0.5">
                {subtask.filesChanged.map((file, i) => {
                  const isViolation = subtask.scopeViolations?.includes(file);
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs ${
                        isViolation
                          ? "bg-status-warning-bg text-status-warning-fg"
                          : "bg-surface-raised text-text-secondary"
                      }`}
                    >
                      {isViolation && <AlertTriangle className="h-3 w-3 shrink-0" />}
                      {file}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!subtask.allowedFiles?.length && !subtask.filesChanged?.length && (
            <p className="text-xs text-text-muted">No file information available.</p>
          )}
        </div>
      )}

      {activeTab === "diff" && subtask.commitSha && (
        <div className="rounded-lg bg-surface-raised p-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <GitCommit className="h-3.5 w-3.5" />
            <span className="font-mono">{subtask.commitSha.slice(0, 8)}</span>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Diff viewer requires GitHub API integration. View the commit in your repository for full
            changes.
          </p>
        </div>
      )}

      {activeTab === "logs" && <SubtaskLogViewer subtaskId={subtask._id} />}
    </div>
  );
}

function SubtaskLogViewer({ subtaskId }: { subtaskId: Id<"subtasks"> }) {
  const apiAny = api as any;
  const logs = useQuery(apiAny.sandbox?.logs?.listBySubtask, { subtaskId });

  if (logs === undefined) {
    return <div className="py-2 text-xs text-text-muted">Loading logs...</div>;
  }

  if (!logs || logs.length === 0) {
    return <div className="py-2 text-xs text-text-muted">No logs yet.</div>;
  }

  const LEVEL_COLOR: Record<string, string> = {
    info: "text-text-secondary",
    stdout: "text-text-primary",
    stderr: "text-status-error-fg",
    system: "text-accent-default",
    error: "text-status-error-fg",
  };

  return (
    <div className="max-h-48 overflow-auto rounded-lg bg-comp-terminal-bg p-2 font-mono text-[11px]">
      {(logs as any[]).map((log: any, i: number) => (
        <div key={log._id ?? i} className={`${LEVEL_COLOR[log.level] ?? "text-text-muted"}`}>
          <span className="mr-2 text-comp-terminal-timestamp">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          {log.message}
        </div>
      ))}
    </div>
  );
}
