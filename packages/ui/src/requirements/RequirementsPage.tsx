"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useProgramContext } from "../programs";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { EditRequirementModal } from "./EditRequirementModal";
import { exportRequirementsCsv } from "./exportCsv";
import { RequirementDetailPanel } from "./RequirementDetailPanel";
import { RowActionMenu } from "./RowActionMenu";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";
type Effort = "low" | "medium" | "high" | "very_high";
type DeliveryPhase = "phase_1" | "phase_2" | "phase_3";
type FilterMode = "all" | "unassigned" | "workstream";

interface RequirementItem {
  _id: string;
  refId: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  fitGap: FitGap;
  effortEstimate?: Effort;
  deliveryPhase?: DeliveryPhase;
  workstreamId?: string;
  workstreamName: string | null;
  taskCount: number;
}

interface WorkstreamItem {
  _id: string;
  name: string;
  shortCode: string;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  must_have: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  should_have: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  nice_to_have: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  deferred: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In Progress",
  complete: "Complete",
  deferred: "Deferred",
};

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  deferred: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function RequirementsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { programId, slug } = useProgramContext();

  const initialFilter =
    searchParams.get("filter") === "unassigned"
      ? ("unassigned" as FilterMode)
      : ("all" as FilterMode);
  const [filterMode, setFilterMode] = useState<FilterMode>(initialFilter);
  const [selectedWorkstream, setSelectedWorkstream] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignWorkstreamId, setAssignWorkstreamId] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // New state for row/bulk actions
  const [editingRequirement, setEditingRequirement] = useState<RequirementItem | null>(null);
  const [viewingRequirementId, setViewingRequirementId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<Status | "">("");
  const [bulkPriorityValue, setBulkPriorityValue] = useState<Priority | "">("");

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as WorkstreamItem[] | undefined;

  const queryArgs = useMemo(() => {
    if (!programId) return "skip" as const;
    const args: Record<string, any> = { programId, limit: 50 };
    if (filterMode === "unassigned") {
      args.unassigned = true;
    } else if (filterMode === "workstream" && selectedWorkstream) {
      args.workstreamId = selectedWorkstream;
    }
    if (cursor) args.cursor = cursor;
    return args;
  }, [programId, filterMode, selectedWorkstream, cursor]);

  const data = useQuery("requirements:listAllByProgram" as any, queryArgs) as
    | { items: RequirementItem[]; totalCount: number; hasMore: boolean; nextCursor?: string }
    | undefined;

  // Existing mutations
  const bulkAssign = useMutation("requirements:bulkAssignWorkstream" as any);
  const bulkCreateTasks = useMutation("requirements:bulkCreateTasks" as any);

  // New mutations
  const updateStatus = useMutation("requirements:updateStatus" as any);
  const bulkUpdateStatusMut = useMutation("requirements:bulkUpdateStatus" as any);
  const bulkUpdatePriorityMut = useMutation("requirements:bulkUpdatePriority" as any);
  const removeRequirement = useMutation("requirements:remove" as any);
  const bulkRemoveMut = useMutation("requirements:bulkRemove" as any);

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i._id)));
    }
  }, [items, selectedIds.size]);

  const handleBulkAssign = useCallback(async () => {
    if (!assignWorkstreamId || selectedIds.size === 0) return;
    await bulkAssign({
      requirementIds: Array.from(selectedIds),
      workstreamId: assignWorkstreamId,
    });
    setSelectedIds(new Set());
    setAssignWorkstreamId("");
  }, [assignWorkstreamId, selectedIds, bulkAssign]);

  const handleBulkCreateTasks = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await bulkCreateTasks({
      requirementIds: Array.from(selectedIds),
    });
    setSelectedIds(new Set());
  }, [selectedIds, bulkCreateTasks]);

  const handleBulkUpdateStatus = useCallback(
    async (status: Status) => {
      if (selectedIds.size === 0) return;
      await bulkUpdateStatusMut({
        requirementIds: Array.from(selectedIds),
        status,
      });
      setSelectedIds(new Set());
      setBulkStatusValue("");
    },
    [selectedIds, bulkUpdateStatusMut],
  );

  const handleBulkUpdatePriority = useCallback(
    async (priority: Priority) => {
      if (selectedIds.size === 0) return;
      await bulkUpdatePriorityMut({
        requirementIds: Array.from(selectedIds),
        priority,
      });
      setSelectedIds(new Set());
      setBulkPriorityValue("");
    },
    [selectedIds, bulkUpdatePriorityMut],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (deletingIds.length === 0) return;
    setIsDeleting(true);
    try {
      if (deletingIds.length === 1) {
        await removeRequirement({ requirementId: deletingIds[0] });
      } else {
        await bulkRemoveMut({ requirementIds: deletingIds });
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of deletingIds) next.delete(id);
        return next;
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingIds([]);
    }
  }, [deletingIds, removeRequirement, bulkRemoveMut]);

  const handleExport = useCallback(() => {
    const selected = items.filter((i) => selectedIds.has(i._id));
    exportRequirementsCsv(selected);
  }, [items, selectedIds]);

  const handleFilterChange = useCallback(
    (mode: FilterMode) => {
      setFilterMode(mode);
      setCursor(undefined);
      setSelectedIds(new Set());
      if (mode === "unassigned") {
        router.replace(`/${slug}/requirements?filter=unassigned`, { scroll: false });
      } else {
        router.replace(`/${slug}/requirements`, { scroll: false });
      }
    },
    [slug, router],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-display-m text-text-heading">Requirements</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {totalCount} requirement{totalCount !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border-default">
          {(["all", "unassigned"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleFilterChange(mode)}
              className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                filterMode === mode
                  ? "bg-accent-default text-text-on-brand"
                  : "bg-surface-default text-text-secondary hover:bg-interactive-hover"
              }`}
            >
              {mode === "all" ? "All" : "Unassigned"}
            </button>
          ))}
        </div>

        {workstreams && workstreams.length > 0 && (
          <select
            value={filterMode === "workstream" ? selectedWorkstream : ""}
            onChange={(e) => {
              if (e.target.value) {
                setFilterMode("workstream");
                setSelectedWorkstream(e.target.value);
                setCursor(undefined);
                setSelectedIds(new Set());
              } else {
                handleFilterChange("all");
                setSelectedWorkstream("");
              }
            }}
            className="select w-full sm:w-auto"
          >
            <option value="">By Workstream</option>
            {workstreams.map((ws) => (
              <option key={ws._id} value={ws._id}>
                {ws.shortCode} - {ws.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-default/30 bg-accent-default/5 px-4 py-3">
          <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border-default" />

          {workstreams && workstreams.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={assignWorkstreamId}
                onChange={(e) => setAssignWorkstreamId(e.target.value)}
                className="select text-sm"
              >
                <option value="">Assign to Workstream...</option>
                {workstreams.map((ws) => (
                  <option key={ws._id} value={ws._id}>
                    {ws.shortCode} - {ws.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!assignWorkstreamId}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-border-default" />

          <select
            value={bulkStatusValue}
            onChange={(e) => {
              const val = e.target.value as Status;
              if (val) handleBulkUpdateStatus(val);
            }}
            className="select text-sm"
          >
            <option value="">Change Status...</option>
            {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={bulkPriorityValue}
            onChange={(e) => {
              const val = e.target.value as Priority;
              if (val) handleBulkUpdatePriority(val);
            }}
            className="select text-sm"
          >
            <option value="">Change Priority...</option>
            {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <button
            onClick={handleBulkCreateTasks}
            className="btn-primary btn-sm inline-flex items-center gap-1.5"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Tasks
          </button>

          <div className="h-4 w-px bg-border-default" />

          <button
            onClick={handleExport}
            className="btn-sm inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Export
          </button>

          <button
            onClick={() => {
              setDeletingIds(Array.from(selectedIds));
              setShowDeleteConfirm(true);
            }}
            className="btn-sm text-sm text-status-error-fg hover:opacity-80"
          >
            Delete Selected
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-text-secondary hover:text-text-primary"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {data === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
        </div>
      ) : items.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm font-medium text-text-secondary">
            {filterMode === "unassigned"
              ? "All requirements are assigned to workstreams"
              : "No requirements found"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left">
                <th className="pb-3 pr-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border-default text-accent-default"
                  />
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Ref ID
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Title
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Priority
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Status
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Workstream
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Tasks
                </th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((req) => (
                <tr
                  key={req._id}
                  className={`border-b border-border-default transition-colors hover:bg-interactive-hover ${
                    selectedIds.has(req._id) ? "bg-accent-default/5" : ""
                  }`}
                >
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(req._id)}
                      onChange={() => toggleSelect(req._id)}
                      className="h-4 w-4 rounded border-border-default text-accent-default"
                    />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-text-secondary">{req.refId}</td>
                  <td className="max-w-[300px] truncate py-3 pr-4 font-medium text-text-primary">
                    {req.title}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[req.priority]}`}
                    >
                      {PRIORITY_LABELS[req.priority]}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[req.status]}`}
                    >
                      {STATUS_LABELS[req.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">
                    {req.workstreamName ?? (
                      <span className="italic text-text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">
                    {req.taskCount > 0 ? (
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-surface-raised px-1.5 py-0.5 text-[11px] font-semibold">
                        {req.taskCount}
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-3">
                    <RowActionMenu
                      requirementId={req._id}
                      currentStatus={req.status}
                      onEdit={() => setEditingRequirement(req)}
                      onViewDetails={() => setViewingRequirementId(req._id)}
                      onStatusChange={(status) => updateStatus({ requirementId: req._id, status })}
                      onDelete={() => {
                        setDeletingIds([req._id]);
                        setShowDeleteConfirm(true);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && (data.hasMore || (cursor && cursor !== "0")) && (
        <div className="flex items-center justify-between border-t border-border-default pt-4">
          <button
            onClick={() => {
              const prev = cursor ? Math.max(0, parseInt(cursor, 10) - 50) : 0;
              setCursor(prev > 0 ? String(prev) : undefined);
            }}
            disabled={!cursor || cursor === "0"}
            className="btn-sm text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Showing {(cursor ? parseInt(cursor, 10) : 0) + 1}-
            {Math.min((cursor ? parseInt(cursor, 10) : 0) + 50, totalCount)} of {totalCount}
          </span>
          <button
            onClick={() => data.nextCursor && setCursor(data.nextCursor)}
            disabled={!data.hasMore}
            className="btn-sm text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingRequirement && (
        <EditRequirementModal
          isOpen={true}
          onClose={() => setEditingRequirement(null)}
          requirementId={editingRequirement._id}
          initialValues={{
            priority: editingRequirement.priority,
            status: editingRequirement.status,
            fitGap: editingRequirement.fitGap,
            effortEstimate: editingRequirement.effortEstimate,
            deliveryPhase: editingRequirement.deliveryPhase,
          }}
        />
      )}

      {/* Detail Panel */}
      <RequirementDetailPanel
        requirementId={viewingRequirementId ?? ""}
        open={viewingRequirementId !== null}
        onClose={() => setViewingRequirementId(null)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false);
            setDeletingIds([]);
          }
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        count={deletingIds.length}
      />
    </div>
  );
}
