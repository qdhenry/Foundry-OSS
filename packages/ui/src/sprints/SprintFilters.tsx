"use client";

type SprintStatus = "planning" | "active" | "completed" | "cancelled";

interface Workstream {
  _id: string;
  name: string;
}

interface SprintFiltersProps {
  workstreams: Workstream[];
  workstreamFilter: string;
  onWorkstreamFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

const STATUS_OPTIONS: { value: SprintStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function SprintFilters({
  workstreams,
  workstreamFilter,
  onWorkstreamFilterChange,
  statusFilter,
  onStatusFilterChange,
}: SprintFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={workstreamFilter}
        onChange={(e) => onWorkstreamFilterChange(e.target.value)}
        className="select"
      >
        <option value="">All Workstreams</option>
        {workstreams.map((ws) => (
          <option key={ws._id} value={ws._id}>
            {ws.name}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="select"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
