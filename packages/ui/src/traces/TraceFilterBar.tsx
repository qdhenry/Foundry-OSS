"use client";

import { SearchMd, XClose } from "@untitledui/icons";
import type { FilterOptions, TraceFilters } from "./types";

interface TraceFilterBarProps {
  filters: TraceFilters;
  onFiltersChange: (filters: TraceFilters) => void;
  options: FilterOptions;
}

const DATE_RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const REVIEW_STATUS_OPTIONS = [
  { label: "All", value: null },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Revised", value: "revised" },
  { label: "Rejected", value: "rejected" },
];

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ label: string; value: string | null }>;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary outline-none focus:border-brand-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value ?? "all"} value={opt.value ?? ""}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TraceFilterBar({ filters, onFiltersChange, options }: TraceFilterBarProps) {
  const hasActiveFilters =
    filters.skill || filters.trigger || filters.reviewStatus || filters.model || filters.search;

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      skill: null,
      trigger: null,
      reviewStatus: null,
      model: null,
      search: "",
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted">Search</label>
        <div className="relative">
          <SearchMd
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Skill, task, requirement..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="h-8 w-52 rounded-md border border-border-default bg-surface-default pl-8 pr-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-blue-500"
          />
        </div>
      </div>

      {/* Date Range */}
      <SelectFilter
        label="Period"
        value={String(filters.dateRange)}
        options={DATE_RANGE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
        onChange={(v) => onFiltersChange({ ...filters, dateRange: Number(v) || 30 })}
      />

      {/* Skill */}
      {options.skills.length > 0 && (
        <SelectFilter
          label="Skill"
          value={filters.skill}
          options={[
            { label: "All skills", value: null },
            ...options.skills.map((s) => ({ label: s, value: s })),
          ]}
          onChange={(v) => onFiltersChange({ ...filters, skill: v })}
        />
      )}

      {/* Trigger */}
      {options.triggers.length > 0 && (
        <SelectFilter
          label="Trigger"
          value={filters.trigger}
          options={[
            { label: "All triggers", value: null },
            ...options.triggers.map((t) => ({
              label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              value: t,
            })),
          ]}
          onChange={(v) => onFiltersChange({ ...filters, trigger: v })}
        />
      )}

      {/* Review Status */}
      <SelectFilter
        label="Review"
        value={filters.reviewStatus}
        options={REVIEW_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        onChange={(v) => onFiltersChange({ ...filters, reviewStatus: v })}
      />

      {/* Model */}
      {options.models.length > 0 && (
        <SelectFilter
          label="Model"
          value={filters.model}
          options={[
            { label: "All models", value: null },
            ...options.models.map((m) => ({ label: m.replace("claude-", ""), value: m })),
          ]}
          onChange={(v) => onFiltersChange({ ...filters, model: v })}
        />
      )}

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-sm text-text-secondary hover:bg-interactive-ghost hover:text-text-primary"
        >
          <XClose size={14} />
          Clear
        </button>
      )}
    </div>
  );
}
