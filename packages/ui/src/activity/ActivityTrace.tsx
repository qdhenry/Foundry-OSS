// packages/ui/src/activity/ActivityTrace.tsx
"use client";

import { useMemo } from "react";
import { TraceGroup } from "./TraceGroup";
import type { EnrichedExecution, TraceContext } from "./utils";
import { groupByRequirement } from "./utils";

interface ActivityTraceProps {
  executions: EnrichedExecution[];
  context: TraceContext;
  onBack: () => void;
}

export function ActivityTrace({ executions, context, onBack }: ActivityTraceProps) {
  const filtered = useMemo(() => executions.filter(context.filterFn), [executions, context]);

  const groups = useMemo(() => groupByRequirement(filtered), [filtered]);

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-accent-default transition-colors hover:text-accent-hover"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to Dashboard
        <span className="ml-1 text-text-muted">· {context.label}</span>
      </button>

      {/* Results count */}
      <p className="type-caption normal-case tracking-normal text-text-muted">
        {filtered.length} {filtered.length === 1 ? "execution" : "executions"} in {groups.length}{" "}
        {groups.length === 1 ? "group" : "groups"}
      </p>

      {/* Grouped trace */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default py-12 text-center">
          <p className="text-sm text-text-secondary">No agent activity matching this filter</p>
          <button
            onClick={onBack}
            className="mt-2 text-sm text-accent-default hover:text-accent-hover"
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <TraceGroup
              key={group.requirementId ?? `unlinked-${group.executions[0]._id}`}
              group={group}
            />
          ))}
        </div>
      )}
    </div>
  );
}
