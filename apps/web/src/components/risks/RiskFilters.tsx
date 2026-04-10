"use client";

type Severity = "critical" | "high" | "medium" | "low";
type Status = "open" | "mitigating" | "resolved" | "accepted";

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Mitigating" },
  { value: "resolved", label: "Resolved" },
  { value: "accepted", label: "Accepted" },
];

interface RiskFiltersProps {
  severity: Severity | "";
  status: Status | "";
  onSeverityChange: (value: Severity | "") => void;
  onStatusChange: (value: Status | "") => void;
}

export function RiskFilters({
  severity,
  status,
  onSeverityChange,
  onStatusChange,
}: RiskFiltersProps) {
  const hasFilters = severity !== "" || status !== "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Severity filter */}
      <select
        value={severity}
        onChange={(e) => onSeverityChange(e.target.value as Severity | "")}
        className="select sm:w-auto"
      >
        <option value="">All Severities</option>
        {SEVERITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as Status | "")}
        className="select sm:w-auto"
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => {
            onSeverityChange("");
            onStatusChange("");
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
