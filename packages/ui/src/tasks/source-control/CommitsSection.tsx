"use client";

import { useState } from "react";

interface Commit {
  sha: string;
  message: string;
  authorLogin: string;
  authorName?: string;
  timestamp: number;
  url?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
}

interface CommitsSectionProps {
  commits: Commit[];
}

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

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CommitRow({ commit }: { commit: Commit }) {
  // Shorten the commit message to first line for the header
  const firstLine = commit.message.split("\n")[0];
  const hasBody = commit.message.split("\n").filter((l) => l.trim()).length > 1;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-5 py-3">
      <div className="flex items-start gap-3">
        {/* SHA */}
        <div className="shrink-0 pt-0.5">
          {commit.url ? (
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-medium text-accent-default hover:text-accent-strong"
            >
              {commit.sha.slice(0, 7)}
            </a>
          ) : (
            <span className="font-mono text-xs text-text-muted">{commit.sha.slice(0, 7)}</span>
          )}
        </div>

        {/* Message + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-text-heading">
              {firstLine}
            </p>
            {hasBody && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 shrink-0 text-[10px] text-text-muted hover:text-text-primary"
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
            <span>{commit.authorName ?? commit.authorLogin}</span>
            <span>·</span>
            <span title={new Date(commit.timestamp).toLocaleString()}>
              {formatRelativeTime(commit.timestamp)}
            </span>
            {commit.filesChanged !== undefined && (
              <>
                <span>·</span>
                <span>
                  {commit.filesChanged} file{commit.filesChanged !== 1 ? "s" : ""}
                </span>
                {commit.additions !== undefined && (
                  <span className="text-status-success-fg">+{commit.additions}</span>
                )}
                {commit.deletions !== undefined && (
                  <span className="text-status-error-fg">-{commit.deletions}</span>
                )}
              </>
            )}
          </div>

          {expanded && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-raised p-2 font-mono text-[10px] text-text-secondary">
              {commit.message}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommitsSection({ commits }: CommitsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        {collapsed ? (
          <ChevronRightIcon className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-text-muted" />
        )}
        <span className="text-sm font-semibold text-text-primary">Commits</span>
        <span className="text-xs text-text-muted">
          {commits.length} commit{commits.length !== 1 ? "s" : ""}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-border-default">
          {commits.length === 0 ? (
            <p className="px-5 py-4 text-xs text-text-muted">No commits yet</p>
          ) : (
            <div className="divide-y divide-border-default">
              {commits.map((commit) => (
                <CommitRow key={commit.sha} commit={commit} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
