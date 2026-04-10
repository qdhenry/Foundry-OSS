"use client";

import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { useProgramContext } from "../programs";
import { TraceDetailDrawer } from "./TraceDetailDrawer";
import { TraceFilterBar } from "./TraceFilterBar";
import { TraceList } from "./TraceList";
import { TraceStatsRow } from "./TraceStatsRow";
import { TraceTimelineChart } from "./TraceTimelineChart";
import type { TraceFilters } from "./types";

export function TracesPage() {
  const { programId } = useProgramContext();
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TraceFilters>({
    dateRange: 30,
    skill: null,
    trigger: null,
    reviewStatus: null,
    model: null,
    search: "",
  });

  const now = useMemo(() => Date.now(), []);
  const startDate = now - filters.dateRange * 24 * 60 * 60 * 1000;

  // Primary data: enriched executions
  const executions = useQuery(
    "agentExecutions:listByProgramWithContext" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  // Aggregate stats
  const stats = useQuery(
    "traceAnalytics:getTraceStats" as any,
    programId ? { programId, startDate, endDate: now } : "skip",
  ) as any | undefined;

  // Timeline for sparkline
  const timeline = useQuery(
    "traceAnalytics:getTraceTimeline" as any,
    programId ? { programId, days: filters.dateRange } : "skip",
  ) as any[] | undefined;

  // Client-side filtering
  const filteredExecutions = useMemo(() => {
    if (!executions) return [];
    return executions.filter((exec) => {
      if (exec._creationTime < startDate) return false;
      if (filters.skill && exec.skillName !== filters.skill) return false;
      if (filters.trigger && exec.trigger !== filters.trigger) return false;
      if (filters.reviewStatus && exec.reviewStatus !== filters.reviewStatus) return false;
      if (filters.model && exec.modelId !== filters.model) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          exec.skillName,
          exec.taskTitle,
          exec.workstreamName,
          exec.requirementTitle,
          exec.requirementRefId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [executions, filters, startDate]);

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!executions) return { skills: [], triggers: [], models: [] };
    const skills = [...new Set(executions.map((e: any) => e.skillName).filter(Boolean))].sort();
    const triggers = [...new Set(executions.map((e: any) => e.trigger).filter(Boolean))].sort();
    const models = [...new Set(executions.map((e: any) => e.modelId).filter(Boolean))].sort();
    return { skills, triggers, models };
  }, [executions]);

  const handleRowClick = useCallback((executionId: string) => {
    setSelectedExecutionId((prev) => (prev === executionId ? null : executionId));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedExecutionId(null);
  }, []);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-heading">AI Traces</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Execution history, cost tracking, and performance analytics
        </p>
      </div>

      {/* Filters */}
      <TraceFilterBar filters={filters} onFiltersChange={setFilters} options={filterOptions} />

      {/* Stats Row */}
      {stats && <TraceStatsRow stats={stats} />}

      {/* Timeline Chart */}
      {timeline && timeline.length > 0 && <TraceTimelineChart data={timeline} />}

      {/* Execution List + Detail Drawer */}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className={`min-h-0 flex-1 ${selectedExecutionId ? "max-w-[60%]" : ""}`}>
          <TraceList
            executions={filteredExecutions}
            selectedId={selectedExecutionId}
            onRowClick={handleRowClick}
            loading={!executions}
          />
        </div>

        {selectedExecutionId && (
          <div className="w-[40%] min-w-[360px]">
            <TraceDetailDrawer executionId={selectedExecutionId} onClose={handleCloseDrawer} />
          </div>
        )}
      </div>
    </div>
  );
}
