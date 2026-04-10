"use client";

import { useRef } from "react";
import { useCountUp } from "../theme/useAnimations";

function StatCard({
  label,
  value,
  format,
  subtitle,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  subtitle?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, value, format ? { format } : undefined);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-default bg-surface-default p-4">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span ref={ref} className="text-2xl font-bold text-text-heading">
        {format ? format(value) : String(value)}
      </span>
      {subtitle && <span className="text-xs text-text-secondary">{subtitle}</span>}
    </div>
  );
}

interface TraceStatsRowProps {
  stats: {
    totalExecutions: number;
    totalCostUsd: number;
    avgDurationMs: number;
    cacheHitRate: number;
    acceptanceRate: number;
  };
}

export function TraceStatsRow({ stats }: TraceStatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      <StatCard label="Executions" value={stats.totalExecutions} />
      <StatCard
        label="Total Cost"
        value={stats.totalCostUsd}
        format={(n) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`)}
      />
      <StatCard
        label="Avg Latency"
        value={stats.avgDurationMs}
        format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`)}
      />
      <StatCard
        label="Cache Hit Rate"
        value={stats.cacheHitRate * 100}
        format={(n) => `${Math.round(n)}%`}
      />
      <StatCard
        label="Acceptance Rate"
        value={stats.acceptanceRate * 100}
        format={(n) => `${Math.round(n)}%`}
      />
    </div>
  );
}
