"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { AreaTimeline } from "../charts";
import { LatencyPercentileCard } from "./LatencyPercentileCard";
import { ModelComparisonTable } from "./ModelComparisonTable";

export function PerformanceAnalytics() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;

  const now = useMemo(() => Date.now(), []);
  const startDate = now - 30 * 24 * 60 * 60 * 1000;

  const latency = useQuery(
    "billing/performanceAnalytics:getLatencyPercentiles" as any,
    orgId ? { orgId, startDate, endDate: now } : "skip",
  ) as any | undefined;

  const trend = useQuery(
    "billing/performanceAnalytics:getDailyPerformanceTrend" as any,
    orgId ? { orgId, days: 14 } : "skip",
  ) as any[] | undefined;

  const models = useQuery(
    "billing/performanceAnalytics:getModelComparison" as any,
    orgId ? { orgId, startDate, endDate: now } : "skip",
  ) as any[] | undefined;

  if (!orgId) return null;

  const isLoading = !latency && !trend && !models;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-text-heading">Performance Analytics</h2>
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-text-heading">Performance Analytics</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Latency percentiles, daily trends, and model comparison (last 30 days)
        </p>
      </div>

      {/* Latency Percentiles */}
      {latency && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-heading">Latency Distribution</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <LatencyPercentileCard label="Overall" data={latency.overall} />
            {latency.byModel?.map((m: any) => (
              <LatencyPercentileCard
                key={m.modelId}
                label={m.modelId.replace("claude-", "")}
                data={m}
              />
            ))}
          </div>
        </div>
      )}

      {/* Daily Trend */}
      {trend && trend.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-heading">Daily Performance Trend</h3>
            <span className="text-xs text-text-muted">Last {trend.length} days</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-text-muted">Cost (USD)</p>
              <AreaTimeline
                data={trend}
                dataKey="costUsd"
                height={120}
                color="var(--brand-blue-500)"
                formatter={(v) => `$${v.toFixed(2)}`}
                showGrid
              />
            </div>
            <div>
              <p className="mb-2 text-xs text-text-muted">Avg Latency (ms)</p>
              <AreaTimeline
                data={trend}
                dataKey="avgDurationMs"
                height={120}
                color="var(--status-warning-fg)"
                formatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`)}
                showGrid
              />
            </div>
          </div>
        </div>
      )}

      {/* Model Comparison */}
      {models && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-heading">Model Comparison</h3>
          <ModelComparisonTable models={models} />
        </div>
      )}
    </div>
  );
}
