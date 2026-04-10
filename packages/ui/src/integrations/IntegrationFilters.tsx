"use client";

export interface IntegrationFilterValues {
  type?: string;
  status?: string;
}

const TYPE_OPTIONS = [
  { value: "api", label: "API" },
  { value: "webhook", label: "Webhook" },
  { value: "file_transfer", label: "File Transfer" },
  { value: "database", label: "Database" },
  { value: "middleware", label: "Middleware" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "testing", label: "Testing" },
  { value: "live", label: "Live" },
  { value: "deprecated", label: "Deprecated" },
];

interface IntegrationFiltersProps {
  filters: IntegrationFilterValues;
  onFilterChange: (filters: IntegrationFilterValues) => void;
}

export function IntegrationFilters({ filters, onFilterChange }: IntegrationFiltersProps) {
  const hasFilters = filters.type || filters.status;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={filters.type ?? ""}
        onChange={(e) => onFilterChange({ ...filters, type: e.target.value || undefined })}
        className="select sm:w-auto"
      >
        <option value="">All Types</option>
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={filters.status ?? ""}
        onChange={(e) => onFilterChange({ ...filters, status: e.target.value || undefined })}
        className="select sm:w-auto"
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => onFilterChange({})}
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
