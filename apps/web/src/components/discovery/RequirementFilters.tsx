"use client";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";

export interface Filters {
  batch?: string;
  priority?: Priority;
  status?: Status;
  workstreamId?: string;
}

interface RequirementFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  workstreams: Array<{ _id: string; name: string }>;
  batches: string[];
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "must_have", label: "Must Have" },
  { value: "should_have", label: "Should Have" },
  { value: "nice_to_have", label: "Nice to Have" },
  { value: "deferred", label: "Deferred" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "deferred", label: "Deferred" },
];

export function RequirementFilters({
  filters,
  onFilterChange,
  workstreams,
  batches,
}: RequirementFiltersProps) {
  const hasActiveFilters =
    filters.batch || filters.priority || filters.status || filters.workstreamId;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Batch filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">Batch</label>
        <select
          value={filters.batch ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              batch: e.target.value || undefined,
            })
          }
          className="select"
        >
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Priority filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">Priority</label>
        <select
          value={filters.priority ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              priority: (e.target.value || undefined) as Priority | undefined,
            })
          }
          className="select"
        >
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">Status</label>
        <select
          value={filters.status ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              status: (e.target.value || undefined) as Status | undefined,
            })
          }
          className="select"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Workstream filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">Workstream</label>
        <select
          value={filters.workstreamId ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              workstreamId: e.target.value || undefined,
            })
          }
          className="select"
        >
          <option value="">All Workstreams</option>
          {workstreams.map((ws) => (
            <option key={ws._id} value={ws._id}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={() => onFilterChange({})}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover hover:text-text-primary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
