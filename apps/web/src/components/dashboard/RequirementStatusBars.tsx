"use client";

interface StatusCounts {
  draft: number;
  approved: number;
  in_progress: number;
  complete: number;
  deferred: number;
  total: number;
}

interface PriorityCounts {
  must_have: number;
  should_have: number;
  nice_to_have: number;
  deferred: number;
  total: number;
}

interface RequirementStatusBarsProps {
  statusCounts: StatusCounts | undefined;
  priorityCounts: PriorityCounts | undefined;
}

const STATUS_SEGMENTS: { key: keyof Omit<StatusCounts, "total">; label: string; color: string }[] =
  [
    { key: "draft", label: "Draft", color: "bg-slate-400" },
    { key: "approved", label: "Approved", color: "bg-blue-500" },
    { key: "in_progress", label: "In Progress", color: "bg-status-warning-fg" },
    { key: "complete", label: "Complete", color: "bg-status-success-fg" },
    { key: "deferred", label: "Deferred", color: "bg-slate-600" },
  ];

const PRIORITY_SEGMENTS: {
  key: keyof Omit<PriorityCounts, "total">;
  label: string;
  color: string;
}[] = [
  { key: "must_have", label: "Must Have", color: "bg-status-error-fg" },
  { key: "should_have", label: "Should Have", color: "bg-status-warning-fg" },
  { key: "nice_to_have", label: "Nice to Have", color: "bg-blue-500" },
  { key: "deferred", label: "Deferred", color: "bg-slate-400" },
];

function StackedBar({
  segments,
  total,
}: {
  segments: { label: string; count: number; color: string }[];
  total: number;
}) {
  if (total === 0) {
    return <div className="h-6 w-full rounded-full bg-surface-elevated" />;
  }

  return (
    <div className="flex h-6 w-full overflow-hidden rounded-full">
      {segments.map((seg) => {
        if (seg.count === 0) return null;
        const pct = (seg.count / total) * 100;
        return (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        );
      })}
    </div>
  );
}

function Legend({ segments }: { segments: { label: string; count: number; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {segments.map((seg) => (
        <span key={seg.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`} />
          {seg.label} ({seg.count})
        </span>
      ))}
    </div>
  );
}

export function RequirementStatusBars({
  statusCounts,
  priorityCounts,
}: RequirementStatusBarsProps) {
  const statusSegments = STATUS_SEGMENTS.map((s) => ({
    label: s.label,
    count: statusCounts?.[s.key] ?? 0,
    color: s.color,
  }));

  const prioritySegments = PRIORITY_SEGMENTS.map((s) => ({
    label: s.label,
    count: priorityCounts?.[s.key] ?? 0,
    color: s.color,
  }));

  const statusTotal = statusCounts?.total ?? 0;
  const priorityTotal = priorityCounts?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-medium text-text-primary">
          By Status
          <span className="ml-2 text-xs font-normal text-text-muted">({statusTotal} total)</span>
        </h4>
        <StackedBar segments={statusSegments} total={statusTotal} />
        <Legend segments={statusSegments} />
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-text-primary">
          By Priority
          <span className="ml-2 text-xs font-normal text-text-muted">({priorityTotal} total)</span>
        </h4>
        <StackedBar segments={prioritySegments} total={priorityTotal} />
        <Legend segments={prioritySegments} />
      </div>
    </div>
  );
}
