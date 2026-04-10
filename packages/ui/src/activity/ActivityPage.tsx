// packages/ui/src/activity/ActivityPage.tsx
"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProgramContext } from "../programs";
import { ActivityDashboard } from "./ActivityDashboard";
import { ActivityTrace } from "./ActivityTrace";
import { CoverageDetail } from "./CoverageDetail";
import type { EnrichedExecution, TraceContext, ViewState } from "./utils";

export function ActivityPage() {
  const { programId } = useProgramContext();

  const [view, setView] = useState<ViewState>("dashboard");
  const [traceContext, setTraceContext] = useState<TraceContext | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Primary data queries
  const executions = useQuery(
    "agentExecutions:listByProgramWithContext" as any,
    programId ? { programId } : "skip",
  ) as EnrichedExecution[] | undefined;

  const requirementSummaries = useQuery(
    "requirements:listSummaryByProgram" as any,
    programId ? { programId } : "skip",
  ) as Array<{ _id: string; refId: string; title: string; workstreamId?: string }> | undefined;

  // Build workstream name map for coverage detail
  const workstreamNames = useMemo(() => {
    const map = new Map<string, string>();
    if (executions) {
      for (const exec of executions) {
        if (exec.workstreamId && exec.workstreamName) {
          map.set(exec.workstreamId, exec.workstreamName);
        }
      }
    }
    return map;
  }, [executions]);

  // Search with debounce
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (query.length < 2) {
        if (view === "trace" && traceContext?.filter === "search") {
          setView("dashboard");
          setTraceContext(null);
        }
        return;
      }

      searchTimerRef.current = setTimeout(() => {
        const lowerQuery = query.toLowerCase();
        setView("trace");
        setTraceContext({
          filter: "search",
          label: `Search: "${query}"`,
          filterFn: (e: EnrichedExecution) =>
            (e.requirementTitle?.toLowerCase().includes(lowerQuery) ?? false) ||
            (e.requirementRefId?.toLowerCase().includes(lowerQuery) ?? false) ||
            (e.taskTitle?.toLowerCase().includes(lowerQuery) ?? false) ||
            (e.workstreamName?.toLowerCase().includes(lowerQuery) ?? false) ||
            (e.skillName?.toLowerCase().includes(lowerQuery) ?? false),
        });
      }, 300);
    },
    [view, traceContext],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleDrillDown = useCallback((context: TraceContext) => {
    setView("trace");
    setTraceContext(context);
    window.scrollTo({ top: 0 });
  }, []);

  const handleCoverageDrillDown = useCallback(() => {
    setView("coverage");
    window.scrollTo({ top: 0 });
  }, []);

  const handleBack = useCallback(() => {
    setView("dashboard");
    setTraceContext(null);
    setSearchQuery("");
  }, []);

  // Loading state
  if (executions === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="type-display-m text-text-heading">Agent Activity</h1>
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Loading activity...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (executions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="type-display-m text-text-heading">Agent Activity</h1>
        <div className="rounded-xl border border-dashed border-border-default px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-interactive-subtle">
            <svg
              className="h-8 w-8 text-accent-default"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">No agent activity yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Activity will appear here as agents execute skills across your program.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header — only on dashboard */}
      {view === "dashboard" && (
        <div>
          <h1 className="type-display-m text-text-heading">Agent Activity</h1>
          <p className="mt-1 text-sm text-text-secondary">AI agent health and traceability</p>
        </div>
      )}

      {/* View router */}
      {view === "dashboard" && (
        <ActivityDashboard
          executions={executions}
          totalRequirements={requirementSummaries?.length ?? 0}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onDrillDown={handleDrillDown}
          onCoverageDrillDown={handleCoverageDrillDown}
        />
      )}

      {view === "trace" && traceContext && (
        <ActivityTrace executions={executions} context={traceContext} onBack={handleBack} />
      )}

      {view === "coverage" && requirementSummaries && (
        <CoverageDetail
          executions={executions}
          requirements={requirementSummaries}
          workstreamNames={workstreamNames}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
