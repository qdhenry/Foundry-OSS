"use client";

import { AreaTimeline } from "../charts";

interface TraceTimelineChartProps {
  data: Array<{ date: string; costUsd: number; executions: number; avgDurationMs: number }>;
}

export function TraceTimelineChart({ data }: TraceTimelineChartProps) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-heading">Execution Volume</h3>
        <span className="text-xs text-text-muted">Last {data.length} days</span>
      </div>
      <AreaTimeline
        data={data}
        dataKey="executions"
        xKey="date"
        height={140}
        color="var(--brand-blue-500)"
        showGrid
        showAxis
        formatter={(value) => `${value} executions`}
      />
    </div>
  );
}
