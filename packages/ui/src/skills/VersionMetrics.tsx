"use client";

import { useQuery } from "convex/react";
import { formatTokens, timeAgo } from "../activity/utils";

interface VersionMetricsProps {
  skillId: string;
}

interface VersionPerf {
  versionId: string;
  version: string;
  message: string | null;
  createdAt: number;
  lineCount: number;
  executionCount: number;
  avgTokens: number;
  avgDurationMs: number;
  acceptanceRate: number;
}

export function VersionMetrics({ skillId }: VersionMetricsProps) {
  const performance = useQuery(
    "skillVersionAnalytics:getVersionPerformance" as any,
    skillId ? { skillId } : "skip",
  ) as VersionPerf[] | undefined;

  if (!performance || performance.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-heading">Version Performance</h3>
      <div className="overflow-hidden rounded-xl border border-border-default">
        {/* Header */}
        <div className="grid grid-cols-[100px_1fr_80px_80px_80px_80px] gap-2 border-b border-border-default bg-surface-raised px-4 py-2">
          <span className="text-xs font-medium text-text-muted">Version</span>
          <span className="text-xs font-medium text-text-muted">Message</span>
          <span className="text-xs font-medium text-text-muted">Runs</span>
          <span className="text-xs font-medium text-text-muted">Avg Tokens</span>
          <span className="text-xs font-medium text-text-muted">Avg Latency</span>
          <span className="text-xs font-medium text-text-muted">Accept %</span>
        </div>
        {/* Rows */}
        {performance.map((v) => (
          <div
            key={v.versionId}
            className="grid grid-cols-[100px_1fr_80px_80px_80px_80px] gap-2 border-b border-border-default px-4 py-2.5 last:border-b-0"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary">{v.version}</span>
              <span className="text-xs text-text-muted">{timeAgo(v.createdAt)}</span>
            </div>
            <span className="truncate self-center text-sm text-text-secondary">
              {v.message ?? "\u2014"}
            </span>
            <span className="self-center text-sm tabular-nums text-text-secondary">
              {v.executionCount}
            </span>
            <span className="self-center text-sm tabular-nums text-text-secondary">
              {v.avgTokens > 0 ? formatTokens(v.avgTokens) : "\u2014"}
            </span>
            <span className="self-center text-sm tabular-nums text-text-secondary">
              {v.avgDurationMs > 0
                ? v.avgDurationMs >= 1000
                  ? `${(v.avgDurationMs / 1000).toFixed(1)}s`
                  : `${v.avgDurationMs}ms`
                : "\u2014"}
            </span>
            <span className="self-center text-sm tabular-nums text-text-secondary">
              {v.executionCount > 0 ? `${Math.round(v.acceptanceRate * 100)}%` : "\u2014"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
