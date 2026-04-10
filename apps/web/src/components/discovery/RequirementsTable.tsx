"use client";

import { useMemo, useState } from "react";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";
type Effort = "low" | "medium" | "high" | "very_high";

interface Requirement {
  _id: string;
  refId: string;
  title: string;
  batch?: string;
  priority: Priority;
  fitGap: FitGap;
  effortEstimate?: Effort;
  status: Status;
  workstreamId?: string;
}

interface RequirementsTableProps {
  requirements: Requirement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  workstreams: Array<{ _id: string; name: string; shortCode: string }>;
}

type SortField = "refId" | "title" | "batch" | "priority" | "fitGap" | "effortEstimate" | "status";
type SortDirection = "asc" | "desc";

const PRIORITY_BADGE: Record<Priority, string> = {
  must_have: "bg-status-info-bg text-status-info-fg",
  should_have: "bg-status-warning-bg text-status-warning-fg",
  nice_to_have: "bg-surface-raised text-text-secondary",
  deferred: "bg-surface-elevated text-text-secondary",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const STATUS_BADGE: Record<Status, string> = {
  draft: "bg-surface-raised text-text-secondary",
  approved: "bg-status-info-bg text-status-info-fg",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  complete: "bg-status-success-bg text-status-success-fg",
  deferred: "bg-surface-elevated text-text-secondary",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In Progress",
  complete: "Complete",
  deferred: "Deferred",
};

const FITGAP_BADGE: Record<FitGap, string> = {
  native: "bg-status-success-bg text-status-success-fg",
  config: "bg-status-info-bg text-status-info-fg",
  custom_dev: "bg-status-warning-bg text-status-warning-fg",
  third_party: "bg-status-success-bg text-status-success-fg",
  not_feasible: "bg-status-error-bg text-status-error-fg",
};

const FITGAP_LABEL: Record<FitGap, string> = {
  native: "Native",
  config: "Config",
  custom_dev: "Custom Dev",
  third_party: "Third Party",
  not_feasible: "Not Feasible",
};

const EFFORT_BADGE: Record<Effort, string> = {
  low: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-info-bg text-status-info-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  very_high: "bg-status-error-bg text-status-error-fg",
};

const EFFORT_LABEL: Record<Effort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
};

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "refId", label: "Ref" },
  { key: "title", label: "Title" },
  { key: "batch", label: "Batch" },
  { key: "priority", label: "Priority" },
  { key: "fitGap", label: "Fit/Gap" },
  { key: "effortEstimate", label: "Effort" },
  { key: "status", label: "Status" },
];

export function RequirementsTable({
  requirements,
  selectedId,
  onSelect,
  workstreams,
}: RequirementsTableProps) {
  const [sortField, setSortField] = useState<SortField>("refId");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const workstreamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ws of workstreams) {
      map.set(ws._id, ws.shortCode);
    }
    return map;
  }, [workstreams]);

  const sorted = useMemo(() => {
    const copy = [...requirements];
    copy.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [requirements, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  if (requirements.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-default px-6 py-12 text-center">
        <p className="text-sm text-text-secondary">No requirements match your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-default bg-surface-raised">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer px-4 py-3 font-medium text-text-secondary transition-colors select-none hover:text-text-heading"
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortField === col.key && (
                    <span className="text-xs">{sortDirection === "asc" ? "\u2191" : "\u2193"}</span>
                  )}
                </span>
              </th>
            ))}
            <th className="px-4 py-3 font-medium text-text-secondary">Workstream</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default bg-surface-default">
          {sorted.map((req) => (
            <tr
              key={req._id}
              onClick={() => onSelect(req._id)}
              className={`cursor-pointer transition-colors ${
                selectedId === req._id ? "bg-interactive-hover" : "hover:bg-interactive-hover"
              }`}
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-secondary">
                {req.refId}
              </td>
              <td className="max-w-xs truncate px-4 py-3 font-medium text-text-heading">
                {req.title}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                {req.batch ?? "\u2014"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[req.priority]}`}
                >
                  {PRIORITY_LABEL[req.priority]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${FITGAP_BADGE[req.fitGap]}`}
                >
                  {FITGAP_LABEL[req.fitGap]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {req.effortEstimate ? (
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_BADGE[req.effortEstimate]}`}
                  >
                    {EFFORT_LABEL[req.effortEstimate]}
                  </span>
                ) : (
                  <span className="text-text-muted">{"\u2014"}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[req.status]}`}
                >
                  {STATUS_LABEL[req.status]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                {req.workstreamId ? (workstreamMap.get(req.workstreamId) ?? "\u2014") : "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
