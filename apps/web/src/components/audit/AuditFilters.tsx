"use client";

type EntityType =
  | "program"
  | "requirement"
  | "risk"
  | "task"
  | "skill"
  | "gate"
  | "sprint"
  | "integration"
  | "document";

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "program", label: "Program" },
  { value: "requirement", label: "Requirement" },
  { value: "risk", label: "Risk" },
  { value: "task", label: "Task" },
  { value: "skill", label: "Skill" },
  { value: "gate", label: "Gate" },
  { value: "sprint", label: "Sprint" },
  { value: "integration", label: "Integration" },
  { value: "document", label: "Document" },
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

interface AuditFiltersProps {
  entityType: string;
  limit: number;
  onEntityTypeChange: (value: string) => void;
  onLimitChange: (value: number) => void;
}

export function AuditFilters({
  entityType,
  limit,
  onEntityTypeChange,
  onLimitChange,
}: AuditFiltersProps) {
  const hasFilters = entityType !== "" || limit !== 50;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Entity type filter */}
      <select
        value={entityType}
        onChange={(e) => onEntityTypeChange(e.target.value)}
        className="select w-full sm:w-auto"
      >
        <option value="">All Types</option>
        {ENTITY_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Limit filter */}
      <select
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        className="select w-full sm:w-auto"
      >
        {LIMIT_OPTIONS.map((val) => (
          <option key={val} value={val}>
            {val} entries
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => {
            onEntityTypeChange("");
            onLimitChange(50);
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
    </div>
  );
}
