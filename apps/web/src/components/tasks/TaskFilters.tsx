"use client";

type Priority = "critical" | "high" | "medium" | "low";
type Status = "backlog" | "todo" | "in_progress" | "review" | "done";
type ViewMode = "board" | "list";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

interface TaskFiltersProps {
  status: Status | "";
  priority: Priority | "";
  workstreamId: string;
  sprintId: string;
  viewMode: ViewMode;
  onStatusChange: (value: Status | "") => void;
  onPriorityChange: (value: Priority | "") => void;
  onWorkstreamChange: (value: string) => void;
  onSprintChange: (value: string) => void;
  onViewModeChange: (value: ViewMode) => void;
  workstreams?: { _id: string; name: string; shortCode: string }[];
  sprints?: { _id: string; name: string; workstreamId: string }[];
}

export function TaskFilters({
  status,
  priority,
  workstreamId,
  sprintId,
  viewMode,
  onStatusChange,
  onPriorityChange,
  onWorkstreamChange,
  onSprintChange,
  onViewModeChange,
  workstreams,
  sprints,
}: TaskFiltersProps) {
  const hasFilters = status !== "" || priority !== "" || workstreamId !== "" || sprintId !== "";

  // Filter sprints by selected workstream
  const filteredSprints =
    workstreamId && sprints ? sprints.filter((s) => s.workstreamId === workstreamId) : sprints;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as Status | "")}
        className="select w-full sm:w-auto"
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value as Priority | "")}
        className="select w-full sm:w-auto"
      >
        <option value="">All Priorities</option>
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Workstream filter */}
      {workstreams && workstreams.length > 0 && (
        <select
          value={workstreamId}
          onChange={(e) => {
            onWorkstreamChange(e.target.value);
            // Reset sprint when workstream changes
            if (e.target.value !== workstreamId) {
              onSprintChange("");
            }
          }}
          className="select w-full sm:w-auto"
        >
          <option value="">All Workstreams</option>
          {workstreams.map((ws) => (
            <option key={ws._id} value={ws._id}>
              {ws.shortCode} - {ws.name}
            </option>
          ))}
        </select>
      )}

      {/* Sprint filter */}
      {filteredSprints && filteredSprints.length > 0 && (
        <select
          value={sprintId}
          onChange={(e) => onSprintChange(e.target.value)}
          className="select w-full sm:w-auto"
        >
          <option value="">All Sprints</option>
          {filteredSprints.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => {
            onStatusChange("");
            onPriorityChange("");
            onWorkstreamChange("");
            onSprintChange("");
          }}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover hover:text-text-primary"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear filters
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggle */}
      <div className="flex rounded-lg border border-border-default">
        <button
          onClick={() => onViewModeChange("board")}
          className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === "board"
              ? "bg-accent-default text-text-on-brand"
              : "bg-surface-default text-text-secondary hover:bg-interactive-hover"
          }`}
        >
          <svg
            className="inline-block h-3.5 w-3.5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
          Board
        </button>
        <button
          onClick={() => onViewModeChange("list")}
          className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === "list"
              ? "bg-accent-default text-text-on-brand"
              : "bg-surface-default text-text-secondary hover:bg-interactive-hover"
          }`}
        >
          <svg
            className="inline-block h-3.5 w-3.5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
          List
        </button>
      </div>
    </div>
  );
}
