"use client";

import { useState } from "react";
import type {
  AuditRecord,
  CostBreakdown,
  PRSummary,
  SandboxLogEntry,
  SubtaskSummary,
} from "./utils";
import { formatAbsoluteTime, formatOutput, formatTokens } from "./utils";

// --- 1. Output Section ---

interface OutputSectionProps {
  output: string;
  input?: string | null;
}

export function OutputSection({ output, input }: OutputSectionProps) {
  const [showInput, setShowInput] = useState(false);

  // Detect if input was truncated at storage time (old records stored ≤200 chars)
  const inputTruncated = input
    ? input.length <= 210 && !input.endsWith(".") && !input.endsWith(">") && !input.endsWith("\n")
    : false;

  return (
    <div className="space-y-3">
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border-default bg-surface-default p-4">
        <pre className="type-code whitespace-pre-wrap leading-relaxed text-text-primary">
          {formatOutput(output)}
        </pre>
      </div>
      {input && (
        <div>
          <button
            onClick={() => setShowInput(!showInput)}
            className="type-caption normal-case tracking-normal text-accent-default hover:text-accent-hover"
          >
            {showInput ? "Hide prompt" : "Show prompt"}
          </button>
          {showInput && (
            <div className="mt-2 overflow-y-auto rounded-lg border border-border-subtle bg-surface-default p-3">
              <pre className="type-code whitespace-pre-wrap leading-relaxed text-text-secondary">
                {input}
              </pre>
              {inputTruncated && (
                <p className="mt-2 type-caption normal-case tracking-normal text-text-muted italic">
                  Prompt truncated — historical record stored before full-text logging was enabled
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- 2. Cost Section ---

interface CostSectionProps {
  costBreakdown: CostBreakdown;
  durationMs?: number | null;
}

export function CostSection({ costBreakdown, durationMs }: CostSectionProps) {
  const totalTokens = costBreakdown.inputTokens + costBreakdown.outputTokens;
  const cacheHitRate =
    costBreakdown.inputTokens > 0
      ? Math.round((costBreakdown.cacheReadTokens / costBreakdown.inputTokens) * 100)
      : 0;

  return (
    <div className="space-y-3">
      <h4 className="type-caption text-text-muted">Cost & Performance</h4>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg bg-surface-raised p-3">
          <p className="type-caption normal-case tracking-normal text-text-muted">Input</p>
          <p className="type-body-s font-medium text-text-primary">
            {formatTokens(costBreakdown.inputTokens)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-raised p-3">
          <p className="type-caption normal-case tracking-normal text-text-muted">Output</p>
          <p className="type-body-s font-medium text-text-primary">
            {formatTokens(costBreakdown.outputTokens)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-raised p-3">
          <p className="type-caption normal-case tracking-normal text-text-muted">Cache Reads</p>
          <p className="type-body-s font-medium text-text-primary">
            {formatTokens(costBreakdown.cacheReadTokens)}
            {cacheHitRate > 0 && (
              <span className="ml-1 text-status-success-fg">({cacheHitRate}%)</span>
            )}
          </p>
        </div>
        <div className="rounded-lg bg-surface-raised p-3">
          <p className="type-caption normal-case tracking-normal text-text-muted">Cache Writes</p>
          <p className="type-body-s font-medium text-text-primary">
            {formatTokens(costBreakdown.cacheCreationTokens)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="badge">{costBreakdown.modelId}</span>
        <span className="type-body-s text-text-secondary">
          {formatTokens(totalTokens)} total tokens
        </span>
        <span className="type-body-s font-medium text-status-warning-fg">
          ${costBreakdown.costUsd.toFixed(4)}
        </span>
        {durationMs != null && (
          <span className="type-body-s text-text-muted">
            {(durationMs / 1000).toFixed(1)}s latency
          </span>
        )}
      </div>
    </div>
  );
}

// --- 3. Code Changes Section ---

interface CodeChangesSectionProps {
  pullRequests: PRSummary[];
  sandboxSession?: {
    commitSha?: string;
    prUrl?: string;
    filesChanged?: number;
    worktreeBranch?: string;
  } | null;
}

const PR_STATE_CLASSES: Record<string, string> = {
  open: "badge-info",
  merged: "badge-success",
  closed: "badge-error",
};

const CI_CLASSES: Record<string, string> = {
  passing: "badge-success",
  failing: "badge-error",
  pending: "badge-warning",
};

export function CodeChangesSection({ pullRequests, sandboxSession }: CodeChangesSectionProps) {
  if (pullRequests.length === 0 && !sandboxSession?.commitSha) return null;

  return (
    <div className="space-y-3">
      <h4 className="type-caption text-text-muted">Code Changes</h4>
      {pullRequests.map((pr) => (
        <div
          key={pr.prNumber}
          className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="type-body-s text-text-primary">
              <span className="font-medium text-accent-default">#{pr.prNumber}</span>
              <span className="ml-1.5">{pr.title}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`badge ${PR_STATE_CLASSES[pr.state] ?? ""}`}>{pr.state}</span>
              {pr.ciStatus !== "none" && (
                <span className={`badge ${CI_CLASSES[pr.ciStatus] ?? ""}`}>CI: {pr.ciStatus}</span>
              )}
              {pr.reviewState !== "none" && (
                <span className="type-caption normal-case tracking-normal text-text-muted">
                  Review: {pr.reviewState}
                </span>
              )}
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3">
            <span className="type-body-s text-status-success-fg">+{pr.additions}</span>
            <span className="type-body-s text-status-error-fg">-{pr.deletions}</span>
            {pr.providerUrl && (
              <a
                href={pr.providerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="type-body-s text-accent-default hover:text-accent-hover"
              >
                View
              </a>
            )}
          </div>
        </div>
      ))}
      {sandboxSession?.commitSha && pullRequests.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised p-3">
          <span className="type-code text-accent-default">
            {sandboxSession.commitSha.slice(0, 8)}
          </span>
          {sandboxSession.worktreeBranch && (
            <span className="type-body-s text-text-muted">on {sandboxSession.worktreeBranch}</span>
          )}
          {sandboxSession.filesChanged != null && (
            <span className="type-body-s text-text-muted">
              {sandboxSession.filesChanged} files changed
            </span>
          )}
          {sandboxSession.prUrl && (
            <a
              href={sandboxSession.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="type-body-s text-accent-default hover:text-accent-hover"
            >
              View PR
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// --- 4. Subtask Section ---

interface SubtaskSectionProps {
  subtasks: SubtaskSummary[];
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  completed: { icon: "✓", color: "text-status-success-fg" },
  executing: { icon: "●", color: "text-accent-default" },
  pending: { icon: "○", color: "text-text-muted" },
  failed: { icon: "✗", color: "text-status-error-fg" },
  retrying: { icon: "↻", color: "text-status-warning-fg" },
  skipped: { icon: "–", color: "text-text-muted" },
};

export function SubtaskSection({ subtasks }: SubtaskSectionProps) {
  if (subtasks.length === 0) return null;

  const completed = subtasks.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-3">
      <h4 className="type-caption text-text-muted">
        Subtasks{" "}
        <span className="normal-case tracking-normal">
          — {completed}/{subtasks.length} completed
        </span>
      </h4>
      <div className="divide-y divide-border-default rounded-lg border border-border-default bg-surface-raised">
        {subtasks.map((s) => {
          const statusInfo = STATUS_ICONS[s.status] ?? STATUS_ICONS.pending;
          return (
            <div key={s._id} className="flex items-center justify-between px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`${statusInfo.color} text-sm`}>{statusInfo.icon}</span>
                <span className="type-body-s text-text-primary truncate">{s.title}</span>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3 text-xs text-text-muted">
                {s.executionDurationMs != null && (
                  <span>{(s.executionDurationMs / 1000).toFixed(1)}s</span>
                )}
                {s.filesChanged && s.filesChanged.length > 0 && (
                  <span>{s.filesChanged.length} files</span>
                )}
                {s.retryCount > 0 && (
                  <span className="text-status-warning-fg">{s.retryCount} retries</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {subtasks
        .filter((s) => s.status === "failed" && s.errorMessage)
        .map((s) => (
          <div
            key={`error-${s._id}`}
            className="rounded-lg border border-status-error-border bg-status-error-bg p-3"
          >
            <p className="type-body-s font-medium text-status-error-fg">{s.title}</p>
            <p className="mt-1 type-code text-status-error-fg">{s.errorMessage}</p>
          </div>
        ))}
    </div>
  );
}

// --- 5. Logs Section ---

interface LogsSectionProps {
  logs: SandboxLogEntry[];
}

const LOG_COLORS: Record<string, string> = {
  error: "text-status-error-fg",
  stderr: "text-status-warning-fg",
  system: "text-accent-default",
  info: "text-text-muted",
  stdout: "text-text-primary",
};

export function LogsSection({ logs }: LogsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="type-caption text-text-muted hover:text-text-secondary"
      >
        Execution Logs ({logs.length}){" "}
        <span className="normal-case tracking-normal">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border-default bg-surface-elevated p-3">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="type-code shrink-0 text-text-muted">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`type-code ${LOG_COLORS[log.level] ?? LOG_COLORS.info}`}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- 6. Review Section ---

interface ReviewSectionProps {
  auditRecords: AuditRecord[];
}

const REVIEW_EVENT_LABELS: Record<string, { label: string; classes: string }> = {
  review_accepted: { label: "Accepted", classes: "badge-success" },
  review_revised: { label: "Revised", classes: "badge-info" },
  review_rejected: { label: "Rejected", classes: "badge-error" },
};

export function ReviewSection({ auditRecords }: ReviewSectionProps) {
  const reviewEvents = auditRecords.filter((r) => r.eventType.startsWith("review_"));

  if (reviewEvents.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="type-caption text-text-muted">Review History</h4>
      <div className="space-y-2">
        {reviewEvents.map((event) => {
          const info = REVIEW_EVENT_LABELS[event.eventType];
          return (
            <div
              key={event._id}
              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {info && <span className={`badge ${info.classes}`}>{info.label}</span>}
                {event.initiatedByName && (
                  <span className="type-body-s text-text-secondary">
                    by {event.initiatedByName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {event.reviewNotes && (
                  <span className="type-body-s text-text-muted italic truncate max-w-xs">
                    "{event.reviewNotes}"
                  </span>
                )}
                <span className="type-caption normal-case tracking-normal text-text-muted">
                  {formatAbsoluteTime(event.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
