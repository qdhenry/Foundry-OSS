"use client";

interface PercentileData {
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  count: number;
}

interface LatencyPercentileCardProps {
  label: string;
  data: PercentileData;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function PercentileBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-xs font-medium text-text-muted">{label}</span>
      <div className="flex-1">
        <div className="h-2 w-full rounded-full bg-surface-raised">
          <div
            className="h-2 rounded-full bg-brand-blue-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="w-16 text-right text-sm tabular-nums font-medium text-text-primary">
        {formatMs(value)}
      </span>
    </div>
  );
}

export function LatencyPercentileCard({ label, data }: LatencyPercentileCardProps) {
  const max = data.p99 || 1;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-default p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-heading">{label}</h4>
        <span className="text-xs text-text-muted">{data.count} calls</span>
      </div>
      <div className="flex flex-col gap-2">
        <PercentileBar label="p50" value={data.p50} max={max} />
        <PercentileBar label="p75" value={data.p75} max={max} />
        <PercentileBar label="p90" value={data.p90} max={max} />
        <PercentileBar label="p99" value={data.p99} max={max} />
      </div>
    </div>
  );
}
