"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { FindingsPagination } from "./FindingsPagination";
import { type ImportStatus, ImportStatusPicker } from "./ImportStatusPicker";
import { MergeableFindingCard, type MergeStrategy } from "./MergeableFindingCard";

export type FindingsTab = "requirement" | "risk" | "integration" | "decision" | "action_item";

type StatusFilter = "pending" | "approved" | "imported" | "rejected" | "all";

interface DiscoveryFindingsReviewProps {
  programId: string;
  orgId: string;
  activeTab: FindingsTab;
  onTabChange: (tab: FindingsTab) => void;
}

const PAGE_SIZE = 10;

const TAB_LABELS: Record<FindingsTab, string> = {
  requirement: "Requirements",
  risk: "Risks",
  integration: "Integrations",
  decision: "Decisions",
  action_item: "Action Items",
};

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "imported", label: "Imported" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function DiscoveryFindingsReview({
  programId,
  orgId,
  activeTab,
  onTabChange,
}: DiscoveryFindingsReviewProps) {
  const findings = useQuery(api.discoveryFindings.listByProgram, {
    programId,
  });

  const requirements = useQuery(api.requirements.listByProgram, {
    programId,
  });

  const reviewFinding = useMutation(api.discoveryFindings.reviewFinding);
  const bulkReview = useMutation(api.discoveryFindings.bulkReviewFindings);
  const importApprovedFindings = useMutation(api.discoveryFindings.importApprovedFindings);
  const mergeFindingIntoRequirement = useMutation(
    api.discoveryFindings.mergeFindingIntoRequirement,
  );
  const revertImport = useMutation(api.discoveryFindings.revertImport);
  const acquireLock = useMutation(api.discoveryFindings.acquireLock);
  const releaseLock = useMutation(api.discoveryFindings.releaseLock);

  const [importStatus, setImportStatus] = useState<ImportStatus>("draft");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [mergedIds, setMergedIds] = useState<Set<string>>(new Set());
  const [lastImportedFindingIds, setLastImportedFindingIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(0);

  const grouped = useMemo(() => {
    const base: Record<FindingsTab, any[]> = {
      requirement: [],
      risk: [],
      integration: [],
      decision: [],
      action_item: [],
    };

    if (!findings) return base;

    for (const finding of findings) {
      if (base[finding.type as FindingsTab]) {
        base[finding.type as FindingsTab].push(finding);
      }
    }

    return base;
  }, [findings]);

  // Count pending per tab (for tab badge display)
  const tabsWithCounts = useMemo(() => {
    return (Object.keys(TAB_LABELS) as FindingsTab[])
      .map((tab) => ({
        tab,
        total: grouped[tab].length,
        pending: grouped[tab].filter((f: any) => f.status === "pending").length,
      }))
      .filter((item) => item.total > 0);
  }, [grouped]);

  const resolvedActiveTab =
    tabsWithCounts.find((item) => item.tab === activeTab)?.tab ??
    tabsWithCounts[0]?.tab ??
    "requirement";

  const currentFindings = grouped[resolvedActiveTab] ?? [];

  // Apply status filter
  const filteredFindings = useMemo(() => {
    if (statusFilter === "all") return currentFindings;
    return currentFindings.filter((finding: any) => {
      if (statusFilter === "approved") {
        return finding.status === "approved" || finding.status === "edited";
      }
      return finding.status === statusFilter;
    });
  }, [currentFindings, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedFindings = filteredFindings.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  // Summary counts for current tab
  const statusSummary = useMemo(() => {
    const total = currentFindings.length;
    const pending = currentFindings.filter((f: any) => f.status === "pending").length;
    const imported = currentFindings.filter((f: any) => f.status === "imported").length;
    const rejected = currentFindings.filter((f: any) => f.status === "rejected").length;
    const approved = currentFindings.filter(
      (f: any) => f.status === "approved" || f.status === "edited",
    ).length;
    return { total, pending, imported, rejected, approved };
  }, [currentFindings]);

  const pendingInCurrentTab = currentFindings.filter(
    (finding: any) => finding.status === "pending",
  );

  const approvedCount =
    findings?.filter((finding: any) => finding.status === "approved" || finding.status === "edited")
      .length ?? 0;

  const requirementOptions = useMemo(() => {
    if (!requirements) return [];
    return requirements.map((requirement: any) => ({
      _id: requirement._id,
      refId: requirement.refId,
      title: requirement.title,
    }));
  }, [requirements]);

  // Reset page when filter or tab changes
  function handleStatusFilterChange(filter: StatusFilter) {
    setStatusFilter(filter);
    setPage(0);
  }

  function handleTabChange(tab: FindingsTab) {
    onTabChange(tab);
    setPage(0);
  }

  async function handleReview(findingId: string, status: "approved" | "rejected") {
    setBusyFindingId(findingId);
    setImportMessage(null);
    try {
      await reviewFinding({
        findingId,
        status,
      });
    } finally {
      setBusyFindingId(null);
    }
  }

  async function handleBulk(status: "approved" | "rejected") {
    const ids = pendingInCurrentTab.map((finding: any) => finding._id);
    if (ids.length === 0) return;

    setBusyFindingId("bulk");
    setImportMessage(null);
    try {
      await bulkReview({
        findingIds: ids,
        status,
      });
    } finally {
      setBusyFindingId(null);
    }
  }

  async function handleMerge(findingId: string, requirementId: string, strategy: MergeStrategy) {
    if (!requirements || !findings) return;
    setBusyFindingId(findingId);
    setImportMessage(null);
    let lockAcquired = false;

    try {
      const lockResult = await acquireLock({
        findingId,
      });
      if (!lockResult.acquired) {
        setImportMessage(
          `Finding is currently being reviewed by ${lockResult.lockedByName ?? "another user"}.`,
        );
        return;
      }
      lockAcquired = true;
      await mergeFindingIntoRequirement({
        findingId,
        requirementId,
        mergeStrategy: strategy,
      });

      setMergedIds((prev) => new Set(prev).add(findingId));
      setImportMessage("Finding merged into existing requirement.");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Merge failed");
    } finally {
      if (lockAcquired) {
        await releaseLock({
          findingId,
        }).catch(() => {});
      }
      setBusyFindingId(null);
    }
  }

  async function handleImportApproved() {
    setIsImporting(true);
    setImportMessage(null);

    try {
      const importedFindingIds = (findings ?? [])
        .filter((finding: any) => finding.status === "approved" || finding.status === "edited")
        .map((finding: any) => finding._id as string);

      const result = await importApprovedFindings({
        programId,
        status: importStatus,
      });

      setLastImportedFindingIds(importedFindingIds);

      setImportMessage(
        `Imported ${result.requirements} requirements, ${result.risks} risks, ${result.integrations} integrations, ${result.decisions} decisions, ${result.tasks} tasks.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setImportMessage(message);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleUndoImport() {
    if (lastImportedFindingIds.length === 0) return;
    setIsImporting(true);
    setImportMessage(null);
    try {
      const reverted = await revertImport({
        findingIds: lastImportedFindingIds,
      });
      setImportMessage(
        `Reverted ${reverted.reverted} imported finding${reverted.reverted === 1 ? "" : "s"}.`,
      );
      setLastImportedFindingIds([]);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Revert failed");
    } finally {
      setIsImporting(false);
    }
  }

  if (findings === undefined) {
    return (
      <section className="rounded-xl border border-border-default bg-surface-default p-5">
        <p className="text-sm text-text-secondary">Loading findings...</p>
      </section>
    );
  }

  if (findings.length === 0) {
    return (
      <section className="rounded-xl border border-border-default bg-surface-default p-5">
        <p className="text-sm text-text-secondary">
          No findings available yet. Upload and analyze documents to generate findings.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border-default bg-surface-default">
      <div className="p-5">
        {/* Type sub-tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border-default pb-3">
          {tabsWithCounts.map(({ tab, pending }) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                resolvedActiveTab === tab
                  ? "bg-status-warning-bg text-status-warning-fg"
                  : "bg-surface-raised text-text-primary hover:bg-surface-elevated"
              }`}
            >
              {TAB_LABELS[tab]} ({pending})
            </button>
          ))}
        </div>

        {/* Status summary */}
        <p className="mb-3 text-xs text-text-secondary">
          {statusSummary.total} total | {statusSummary.pending} pending | {statusSummary.approved}{" "}
          approved | {statusSummary.imported} imported | {statusSummary.rejected} rejected
        </p>

        {/* Status filter + bulk actions row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilter)}
            className="select"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => handleBulk("approved")}
            disabled={pendingInCurrentTab.length === 0 || busyFindingId !== null}
            className="rounded-lg bg-status-success-fg px-3 py-1.5 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-60"
          >
            Approve All In Tab
          </button>
          <button
            type="button"
            onClick={() => handleBulk("rejected")}
            disabled={pendingInCurrentTab.length === 0 || busyFindingId !== null}
            className="rounded-lg bg-status-error-fg px-3 py-1.5 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-60"
          >
            Reject All In Tab
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ImportStatusPicker
              value={importStatus}
              onChange={setImportStatus}
              disabled={isImporting}
            />
            <button
              type="button"
              onClick={handleImportApproved}
              disabled={approvedCount === 0 || isImporting}
              className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-60"
            >
              {isImporting ? "Importing..." : `Import Approved (${approvedCount})`}
            </button>
          </div>
        </div>

        {importMessage && (
          <div className="mb-4 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs text-text-primary">
            <div className="flex flex-wrap items-center gap-2">
              <span>{importMessage}</span>
              {lastImportedFindingIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoImport}
                  disabled={isImporting}
                  className="rounded border border-border-default px-2 py-0.5 text-[11px] font-medium text-text-primary hover:bg-interactive-hover disabled:opacity-60"
                >
                  Revert Import
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {paginatedFindings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-default p-6 text-center text-sm text-text-secondary">
              No {statusFilter === "all" ? "" : statusFilter} findings in this tab.
            </div>
          ) : (
            paginatedFindings.map((finding: any) => (
              <MergeableFindingCard
                key={finding._id}
                finding={finding}
                requirements={requirementOptions}
                isBusy={busyFindingId === finding._id || busyFindingId === "bulk" || isImporting}
                isMerged={mergedIds.has(finding._id)}
                onApprove={(findingId) => handleReview(findingId, "approved")}
                onReject={(findingId) => handleReview(findingId, "rejected")}
                onMerge={handleMerge}
              />
            ))
          )}
        </div>

        <FindingsPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </section>
  );
}
