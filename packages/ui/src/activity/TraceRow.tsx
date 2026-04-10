"use client";

import { useQuery } from "convex/react";
import {
  CodeChangesSection,
  CostSection,
  LogsSection,
  OutputSection,
  ReviewSection,
  SubtaskSection,
} from "./TraceDetailSections";
import type { EnrichedExecution, ExecutionDetail } from "./utils";
import {
  formatAbsoluteTime,
  formatTokens,
  humanizeTaskType,
  sanitizePreview,
  timeAgo,
} from "./utils";

interface TraceRowProps {
  execution: EnrichedExecution;
  isExpanded: boolean;
  onToggle: () => void;
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  pr_event: "PR Event",
  gate_trigger: "Gate Trigger",
  scheduled: "Scheduled",
};

export function TraceRow({ execution, isExpanded, onToggle }: TraceRowProps) {
  const isRejected = execution.reviewStatus === "rejected";
  const isRevised = execution.reviewStatus === "revised";
  const hasError = isRejected || isRevised;

  // Fetch rich detail only when expanded
  const detail = useQuery(
    "agentExecutions:getDetail" as any,
    isExpanded ? { executionId: execution._id as any } : "skip",
  ) as ExecutionDetail | undefined;

  return (
    <div className="border-b border-border-default last:border-b-0">
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-interactive-hover ${
          hasError ? "border-l-2 border-l-status-error-fg pl-3.5" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="type-body-s font-medium text-text-primary">
            {humanizeTaskType(execution.taskType)}
          </p>
          <p className="mt-0.5 line-clamp-1 type-caption normal-case tracking-normal text-text-muted">
            {hasError && execution.outputSummary
              ? sanitizePreview(execution.outputSummary)
              : execution.inputSummary
                ? sanitizePreview(execution.inputSummary)
                : "No summary available"}
          </p>
        </div>
        <div className="ml-6 flex shrink-0 items-center gap-4 text-xs text-text-muted">
          {execution.tokensUsed != null && <span>{formatTokens(execution.tokensUsed)}</span>}
          {execution.durationMs != null && <span>{(execution.durationMs / 1000).toFixed(1)}s</span>}
          <span>{timeAgo(execution._creationTime)}</span>
          <svg
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail — rich audit trail */}
      {isExpanded && (
        <div className="border-t border-border-default bg-surface-raised p-4 pl-6">
          {/* Header badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(detail?.skillName ?? execution.skillName) && (
              <span className="badge badge-success">
                {detail?.skillName ?? execution.skillName}
              </span>
            )}
            <span className="badge">{TRIGGER_LABELS[execution.trigger] ?? execution.trigger}</span>
            {(detail?.modelId ?? (execution as any).modelId) && (
              <span className="badge">{detail?.modelId ?? (execution as any).modelId}</span>
            )}
            {detail?.userName && (
              <span className="type-caption normal-case tracking-normal text-text-secondary">
                by {detail.userName}
              </span>
            )}
            <span className="type-caption normal-case tracking-normal text-text-secondary">
              {formatAbsoluteTime(execution._creationTime)}
            </span>
          </div>

          {/* Section 1: Output */}
          <OutputSection
            output={detail?.outputSummary ?? execution.outputSummary ?? "No output"}
            input={detail?.inputSummary ?? execution.inputSummary}
          />

          {/* Section 2: Cost & Performance */}
          {detail?.costBreakdown && (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <CostSection costBreakdown={detail.costBreakdown} durationMs={detail.durationMs} />
            </div>
          )}

          {/* Section 3: Code Changes */}
          {(detail?.pullRequests?.length ?? 0) > 0 || detail?.sandboxSession?.commitSha ? (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <CodeChangesSection
                pullRequests={detail?.pullRequests ?? []}
                sandboxSession={detail?.sandboxSession}
              />
            </div>
          ) : null}

          {/* Section 4: Subtask Progress */}
          {(detail?.subtasks?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <SubtaskSection subtasks={detail?.subtasks} />
            </div>
          )}

          {/* Section 5: Execution Logs */}
          {(detail?.sandboxLogs?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <LogsSection logs={detail?.sandboxLogs} />
            </div>
          )}

          {/* Section 6: Review History */}
          {(detail?.auditRecords?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <ReviewSection auditRecords={detail?.auditRecords} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
