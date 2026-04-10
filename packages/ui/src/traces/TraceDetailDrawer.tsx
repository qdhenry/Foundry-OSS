"use client";

import { XClose } from "@untitledui/icons";
import { useQuery } from "convex/react";
import { formatAbsoluteTime, formatTokens, timeAgo } from "../activity/utils";

interface TraceDetailDrawerProps {
  executionId: string;
  onClose: () => void;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sandbox_started: { label: "Sandbox Started", color: "text-brand-blue-600" },
  sandbox_completed: { label: "Sandbox Completed", color: "text-status-success-fg" },
  sandbox_failed: { label: "Sandbox Failed", color: "text-status-error-fg" },
  sandbox_cancelled: { label: "Sandbox Cancelled", color: "text-status-warning-fg" },
  review_accepted: { label: "Review Accepted", color: "text-status-success-fg" },
  review_rejected: { label: "Review Rejected", color: "text-status-error-fg" },
  review_revised: { label: "Review Revised", color: "text-status-warning-fg" },
  subtask_started: { label: "Subtask Started", color: "text-brand-blue-600" },
  subtask_completed: { label: "Subtask Completed", color: "text-status-success-fg" },
  subtask_failed: { label: "Subtask Failed", color: "text-status-error-fg" },
  subtask_retried: { label: "Subtask Retried", color: "text-status-warning-fg" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

export function TraceDetailDrawer({ executionId, onClose }: TraceDetailDrawerProps) {
  const detail = useQuery("traceAnalytics:getExecutionDetail" as any, { executionId }) as
    | any
    | undefined;

  if (!detail) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-border-default bg-surface-default">
        <div className="flex items-center justify-between border-b border-border-default p-4">
          <span className="text-sm font-medium text-text-muted">Loading...</span>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            <XClose size={16} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-default bg-surface-default">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default p-4">
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <h3 className="truncate text-sm font-semibold text-text-heading">
            {detail.taskTitle ?? detail.taskType ?? "Execution Detail"}
          </h3>
          <span className="text-xs text-text-muted">{timeAgo(detail._creationTime)}</span>
        </div>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
          <XClose size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {/* Overview */}
        <Section title="Overview">
          <DetailRow label="Skill" value={detail.skillName ?? "—"} />
          <DetailRow label="Trigger" value={detail.trigger} />
          <DetailRow label="Model" value={detail.modelId?.replace("claude-", "") ?? "—"} />
          <DetailRow label="Status" value={detail.reviewStatus} />
          <DetailRow label="User" value={detail.userName ?? "—"} />
          <DetailRow label="Time" value={formatAbsoluteTime(detail._creationTime)} />
          {detail.durationMs && (
            <DetailRow
              label="Duration"
              value={
                detail.durationMs >= 1000
                  ? `${(detail.durationMs / 1000).toFixed(1)}s`
                  : `${detail.durationMs}ms`
              }
            />
          )}
          {detail.tokensUsed && (
            <DetailRow label="Tokens" value={formatTokens(detail.tokensUsed)} />
          )}
        </Section>

        {/* Cost Breakdown */}
        {detail.costBreakdown && (
          <Section title="Cost Breakdown">
            <DetailRow
              label="Input Tokens"
              value={formatTokens(detail.costBreakdown.inputTokens)}
            />
            <DetailRow
              label="Output Tokens"
              value={formatTokens(detail.costBreakdown.outputTokens)}
            />
            <DetailRow
              label="Cache Read"
              value={formatTokens(detail.costBreakdown.cacheReadTokens)}
            />
            <DetailRow
              label="Cache Create"
              value={formatTokens(detail.costBreakdown.cacheCreationTokens)}
            />
            <div className="mt-1 border-t border-border-default pt-1">
              <DetailRow
                label="Total Cost"
                value={
                  <span className="font-semibold">
                    {detail.costBreakdown.costUsd < 0.01
                      ? "<$0.01"
                      : `$${detail.costBreakdown.costUsd.toFixed(4)}`}
                  </span>
                }
              />
            </div>
            {/* Cache hit rate for this execution */}
            {(detail.costBreakdown.inputTokens > 0 || detail.costBreakdown.cacheReadTokens > 0) && (
              <DetailRow
                label="Cache Hit Rate"
                value={`${Math.round(
                  (detail.costBreakdown.cacheReadTokens /
                    (detail.costBreakdown.inputTokens + detail.costBreakdown.cacheReadTokens)) *
                    100,
                )}%`}
              />
            )}
          </Section>
        )}

        {/* Input/Output */}
        {detail.inputSummary && (
          <Section title="Input">
            <p className="max-h-32 overflow-y-auto rounded-lg bg-surface-raised p-3 text-xs text-text-secondary">
              {detail.inputSummary}
            </p>
          </Section>
        )}

        {detail.outputSummary && (
          <Section title="Output">
            <p className="max-h-48 overflow-y-auto rounded-lg bg-surface-raised p-3 text-xs text-text-secondary whitespace-pre-wrap">
              {detail.outputSummary}
            </p>
          </Section>
        )}

        {/* Audit Events */}
        {detail.auditEvents && detail.auditEvents.length > 0 && (
          <Section title="Audit Trail">
            <div className="flex flex-col gap-2">
              {detail.auditEvents.map((event: any) => {
                const meta = EVENT_TYPE_LABELS[event.eventType] ?? {
                  label: event.eventType,
                  color: "text-text-secondary",
                };
                return (
                  <div
                    key={event._id}
                    className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      {event.initiatedByName && (
                        <span className="text-xs text-text-muted">by {event.initiatedByName}</span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">{timeAgo(event.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
