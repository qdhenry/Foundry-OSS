// packages/ui/src/activity/TraceGroup.tsx
"use client";

import { useState } from "react";
import { TraceRow } from "./TraceRow";
import type { RequirementGroup } from "./utils";
import { timeAgo } from "./utils";

interface TraceGroupProps {
  group: RequirementGroup;
  defaultExpanded?: string | null;
}

export function TraceGroup({ group, defaultExpanded = null }: TraceGroupProps) {
  const [expandedId, setExpandedId] = useState<string | null>(defaultExpanded);

  const allAccepted = group.successCount === group.totalCount;
  const hasFailed = group.executions.some(
    (e) => e.reviewStatus === "rejected" || e.reviewStatus === "revised",
  );

  const statusBadge = hasFailed
    ? {
        label: `${group.successCount}/${group.totalCount} OK`,
        classes: "bg-status-error-bg text-status-error-fg",
      }
    : allAccepted && group.totalCount > 0
      ? {
          label: `${group.totalCount}/${group.totalCount} OK`,
          classes: "bg-status-success-bg text-status-success-fg",
        }
      : {
          label: `${group.successCount}/${group.totalCount} reviewed`,
          classes: "bg-status-warning-bg text-status-warning-fg",
        };

  return (
    <div className="card overflow-hidden">
      {/* Group header */}
      <div className="card-header flex items-center justify-between mb-3">
        <div>
          <h3 className="type-body-s font-semibold text-text-heading">
            {group.requirementRefId && (
              <span className="mr-1.5 text-accent-default">{group.requirementRefId}:</span>
            )}
            {group.requirementTitle}
          </h3>
          <p className="mt-0.5 type-caption normal-case tracking-normal text-text-muted">
            {group.workstreamName && <>{group.workstreamName} · </>}
            {group.totalCount} {group.totalCount === 1 ? "execution" : "executions"} · Last:{" "}
            {timeAgo(group.lastExecutionTime)}
          </p>
        </div>
        <span className={`badge ${statusBadge.classes}`}>{statusBadge.label}</span>
      </div>

      {/* Nested execution rows */}
      <div className="border-t border-border-default">
        <div className=" border-l-border-subtle">
          {group.executions.map((exec) => (
            <TraceRow
              key={exec._id}
              execution={exec}
              isExpanded={expandedId === exec._id}
              onToggle={() => setExpandedId((prev) => (prev === exec._id ? null : exec._id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
