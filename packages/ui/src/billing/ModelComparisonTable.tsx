"use client";

interface ModelRow {
  modelId: string;
  avgCostPerCall: number;
  totalCostUsd: number;
  avgDurationMs: number;
  cacheHitRate: number;
  volume: number;
}

interface ModelComparisonTableProps {
  models: ModelRow[];
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export function ModelComparisonTable({ models }: ModelComparisonTableProps) {
  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-8 text-center">
        <p className="text-sm text-text-muted">No model data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-default">
      <div className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 border-b border-border-default bg-surface-raised px-4 py-2">
        <span className="text-xs font-medium text-text-muted">Model</span>
        <span className="text-xs font-medium text-text-muted">Avg Cost</span>
        <span className="text-xs font-medium text-text-muted">Total Cost</span>
        <span className="text-xs font-medium text-text-muted">Avg Latency</span>
        <span className="text-xs font-medium text-text-muted">Cache Hit</span>
        <span className="text-xs font-medium text-text-muted">Volume</span>
      </div>
      {models.map((model) => (
        <div
          key={model.modelId}
          className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 border-b border-border-default px-4 py-2.5 last:border-b-0"
        >
          <span className="truncate text-sm font-medium text-text-primary">
            {model.modelId.replace("claude-", "")}
          </span>
          <span className="text-sm tabular-nums text-text-secondary">
            {formatCost(model.avgCostPerCall)}
          </span>
          <span className="text-sm tabular-nums text-text-secondary">
            {formatCost(model.totalCostUsd)}
          </span>
          <span className="text-sm tabular-nums text-text-secondary">
            {model.avgDurationMs > 0 ? formatMs(model.avgDurationMs) : "—"}
          </span>
          <span className="text-sm tabular-nums text-text-secondary">
            {`${Math.round(model.cacheHitRate * 100)}%`}
          </span>
          <span className="text-sm tabular-nums text-text-secondary">{model.volume}</span>
        </div>
      ))}
    </div>
  );
}
