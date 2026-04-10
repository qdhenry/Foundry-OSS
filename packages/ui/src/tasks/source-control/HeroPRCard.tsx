"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useServiceGate } from "../../resilience/useServiceGate";

interface HeroPRCardProps {
  taskId: string;
}

type PRState = "open" | "closed" | "merged";
type CIStatus = "none" | "passing" | "failing" | "pending";
type ReviewState = "none" | "pending" | "approved" | "changes_requested";
type MergeStrategy = "squash" | "merge" | "rebase";

function safeErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    if (message != null) {
      try {
        const serialized = JSON.stringify(message);
        if (serialized && serialized !== "{}") return serialized;
      } catch {
        // Fall through to fallback.
      }
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to fallback.
  }
  return fallback;
}

const PR_STATE_BADGE: Record<string, { classes: string; label: string }> = {
  draft: {
    classes: "bg-surface-elevated text-text-secondary",
    label: "Draft",
  },
  open: {
    classes: "bg-status-info-bg text-status-info-fg",
    label: "Open",
  },
  merged: {
    classes: "bg-status-success-bg text-status-success-fg",
    label: "Merged",
  },
  closed: {
    classes: "bg-surface-elevated text-text-secondary",
    label: "Closed",
  },
};

const CI_CONFIG: Record<CIStatus, { dot: string; label: string; badge: string }> = {
  passing: {
    dot: "bg-status-success-fg",
    label: "CI passing",
    badge: "bg-status-success-bg text-status-success-fg",
  },
  failing: {
    dot: "bg-status-error-fg",
    label: "CI failing",
    badge: "bg-status-error-bg text-status-error-fg",
  },
  pending: {
    dot: "bg-status-warning-fg",
    label: "CI pending",
    badge: "bg-status-warning-bg text-status-warning-fg",
  },
  none: {
    dot: "bg-text-muted",
    label: "No CI",
    badge: "bg-surface-elevated text-text-secondary",
  },
};

const REVIEW_CONFIG: Record<ReviewState, { label: string; badge: string }> = {
  approved: {
    label: "Approved",
    badge: "bg-status-success-bg text-status-success-fg",
  },
  changes_requested: {
    label: "Changes requested",
    badge: "bg-status-error-bg text-status-error-fg",
  },
  pending: {
    label: "Review pending",
    badge: "bg-status-warning-bg text-status-warning-fg",
  },
  none: {
    label: "No reviews",
    badge: "bg-surface-elevated text-text-secondary",
  },
};

// --- Icons ---

function GitMergeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v12M18 9a9 9 0 01-9 9" />
    </svg>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3v12m0 0a3 3 0 103 3H15a3 3 0 100-3H9m-3 0a3 3 0 01-3-3"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

// --- Edit Description Modal ---

interface EditDescriptionModalProps {
  prId: string;
  initialBody: string;
  onClose: () => void;
  onSave: (description: string) => Promise<void>;
}

function EditDescriptionModal({ prId, initialBody, onClose, onSave }: EditDescriptionModalProps) {
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(body);
      onClose();
    } catch (e: unknown) {
      setError(safeErrorMessage(e, "Failed to update description"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay flex items-center justify-center px-4">
      <div className="modal w-full max-w-lg p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Edit PR Description</h3>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="textarea"
        />
        {error && <p className="mt-2 text-xs text-status-error-fg">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-interactive-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary btn-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Request Review Popover ---

interface ReviewerCandidate {
  login: string;
  avatarUrl?: string;
  name?: string;
  role?: string;
  source: "github" | "team";
}

interface RequestReviewPopoverProps {
  prId: string;
  onClose: () => void;
  onRequest: (logins: string[]) => Promise<void>;
}

function RequestReviewPopover({ prId, onClose, onRequest }: RequestReviewPopoverProps) {
  const getCandidates = useAction(
    "sourceControl/tasks/prActionsInternal:getReviewerCandidates" as any,
  );

  const [candidates, setCandidates] = useState<ReviewerCandidate[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load candidates on mount
  useState(() => {
    if (getCandidates) {
      setLoadingCandidates(true);
      getCandidates({ prId })
        .then((result: any) => {
          const merged: ReviewerCandidate[] = [
            ...(result.githubCollaborators ?? []).map((c: any) => ({
              login: c.login,
              avatarUrl: c.avatarUrl,
              source: "github" as const,
            })),
            ...(result.teamMembers ?? []).map((m: any) => ({
              login: m.email,
              name: m.name,
              role: m.role,
              source: "team" as const,
            })),
          ];
          setCandidates(merged);
        })
        .catch(() => setCandidates([]))
        .finally(() => setLoadingCandidates(false));
    }
  });

  function toggleCandidate(login: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  }

  async function handleRequest() {
    if (selected.size === 0) return;
    setRequesting(true);
    setError(null);
    try {
      await onRequest(Array.from(selected));
      onClose();
    } catch (e: unknown) {
      setError(safeErrorMessage(e, "Failed to request review"));
    } finally {
      setRequesting(false);
    }
  }

  const filtered = (candidates ?? []).filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return c.login.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q);
  });

  return (
    <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-xl border border-border-default bg-surface-default p-4 shadow-xl">
      <h4 className="mb-2 text-xs font-semibold text-text-primary">Request reviewers</h4>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or username..."
        className="input"
      />

      <div className="mt-2 max-h-48 overflow-y-auto">
        {loadingCandidates ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            <span className="ml-2 text-xs text-text-muted">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-3 text-center text-xs text-text-muted">No reviewers found</p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((c) => (
              <label
                key={c.login}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-interactive-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.login)}
                  onChange={() => toggleCandidate(c.login)}
                  className="h-3.5 w-3.5 rounded border-border-default text-accent-default focus:ring-accent-default"
                />
                {c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-5 w-5 rounded-full" />}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-text-primary">
                    {c.name ?? c.login}
                  </span>
                  {c.name && (
                    <span className="block truncate text-[10px] text-text-muted">@{c.login}</span>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {c.source === "github" ? "GitHub" : (c.role ?? "Team")}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-status-error-fg">{error}</p>}

      <div className="mt-3 flex items-center justify-between border-t border-border-default pt-3">
        <span className="text-[10px] text-text-muted">{selected.size} selected</span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleRequest}
            disabled={requesting || selected.size === 0}
            className="btn-primary btn-sm disabled:opacity-50"
          >
            {requesting ? "Requesting..." : "Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Merge Dropdown ---

interface MergeDropdownProps {
  onMerge: (strategy: MergeStrategy) => Promise<void>;
  disabled?: boolean;
}

function MergeDropdown({ onMerge, disabled }: MergeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  async function handleMerge(strategy: MergeStrategy) {
    setOpen(false);
    setMerging(true);
    try {
      await onMerge(strategy);
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || merging}
        className="flex items-center gap-1 rounded-lg bg-status-success-bg px-3 py-1.5 text-xs font-medium text-status-success-fg border border-status-success-border transition-colors hover:opacity-80 disabled:opacity-50"
      >
        {merging ? "Merging..." : "Merge"}
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-xl border border-border-default bg-surface-default shadow-xl">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Merge strategy
            </div>
            {(
              [
                {
                  strategy: "squash" as MergeStrategy,
                  label: "Squash and merge",
                  desc: "Combine all commits into one",
                },
                {
                  strategy: "merge" as MergeStrategy,
                  label: "Create a merge commit",
                  desc: "Preserve full commit history",
                },
                {
                  strategy: "rebase" as MergeStrategy,
                  label: "Rebase and merge",
                  desc: "Reapply commits on base branch",
                },
              ] as const
            ).map(({ strategy, label, desc }) => (
              <button
                key={strategy}
                onClick={() => handleMerge(strategy)}
                className="flex w-full flex-col px-3 py-2.5 text-left transition-colors hover:bg-interactive-hover"
              >
                <span className="text-xs font-medium text-text-heading">{label}</span>
                <span className="text-[10px] text-text-secondary">{desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Component ---

export function HeroPRCard({ taskId }: HeroPRCardProps) {
  const pr = useQuery("sourceControl/tasks/prLifecycle:getActiveHeroPR" as any, { taskId });

  // Mutations — may be undefined until prActions.ts is deployed
  const promoteToReady = useMutation("sourceControl/tasks/prActions:promoteToReady" as any);
  const editDescription = useMutation("sourceControl/tasks/prActions:editDescription" as any);
  const requestReview = useMutation("sourceControl/tasks/prActions:requestReview" as any);
  const merge = useMutation("sourceControl/tasks/prActions:merge" as any);
  const closePR = useMutation("sourceControl/tasks/prActions:close" as any);
  const reopenPR = useMutation("sourceControl/tasks/prActions:reopen" as any);
  const triggerAIReview = useAction("sourceControl/tasks/prActionsInternal:triggerAIReview" as any);
  const regenerateDescription = useAction(
    "sourceControl/tasks/prActionsInternal:regenerateDescription" as any,
  );

  const { assertAvailable } = useServiceGate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReviewPopover, setShowReviewPopover] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [promotingDraft, setPromotingDraft] = useState(false);
  const [closingPR, setClosingPR] = useState(false);
  const [reopeningPR, setReopeningPR] = useState(false);
  const [triggeringAI, setTriggeringAI] = useState(false);
  const [generatingAISummary, setGeneratingAISummary] = useState(false);

  // Loading skeleton
  if (pr === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-12 animate-pulse rounded-full bg-surface-raised" />
            <div className="h-4 w-48 animate-pulse rounded bg-surface-raised" />
          </div>
          <div className="h-4 w-64 animate-pulse rounded bg-surface-raised" />
          <div className="flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-raised" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-raised" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-raised" />
          </div>
        </div>
      </div>
    );
  }

  // No active PR
  if (pr === null) {
    return null;
  }

  const isDraft = pr.isDraft;
  const displayState = isDraft ? "draft" : pr.state;
  const stateBadge = PR_STATE_BADGE[displayState] ?? PR_STATE_BADGE.open;
  const ciConfig = CI_CONFIG[(pr.ciStatus as CIStatus) ?? "none"];
  const reviewConfig = REVIEW_CONFIG[(pr.reviewState as ReviewState) ?? "none"];
  const reviewCount = pr.reviews?.length ?? 0;
  const isMerged = pr.state === "merged";
  const isClosed = pr.state === "closed" && !isDraft;
  const _canMerge =
    pr.state === "open" && !isDraft && pr.reviewState === "approved" && pr.ciStatus === "passing";

  async function handlePromoteDraft() {
    if (!promoteToReady) return;
    setPromotingDraft(true);
    setActionError(null);
    try {
      assertAvailable(["convex", "github"]);
      await promoteToReady({ prId: pr._id });
    } catch (e: unknown) {
      setActionError(safeErrorMessage(e, "Failed to promote PR"));
    } finally {
      setPromotingDraft(false);
    }
  }

  async function handleEditDescription(description: string) {
    if (!editDescription) throw new Error("Action not available");
    await editDescription({ prId: pr._id, description });
  }

  async function handleRequestReview(logins: string[]) {
    if (!requestReview) throw new Error("Action not available");
    await requestReview({ prId: pr._id, reviewerLogins: logins });
  }

  async function handleMerge(strategy: MergeStrategy) {
    if (!merge) return;
    setActionError(null);
    try {
      assertAvailable(["convex", "github"]);
      await merge({ prId: pr._id, strategy });
    } catch (e: unknown) {
      setActionError(safeErrorMessage(e, "Failed to merge PR"));
    }
  }

  async function handleClose() {
    if (!closePR) return;
    setClosingPR(true);
    setActionError(null);
    try {
      assertAvailable(["convex", "github"]);
      await closePR({ prId: pr._id });
    } catch (e: unknown) {
      setActionError(safeErrorMessage(e, "Failed to close PR"));
    } finally {
      setClosingPR(false);
    }
  }

  async function handleReopen() {
    if (!reopenPR) return;
    setReopeningPR(true);
    setActionError(null);
    try {
      await reopenPR({ prId: pr._id });
    } catch (e: unknown) {
      setActionError(safeErrorMessage(e, "Failed to reopen PR"));
    } finally {
      setReopeningPR(false);
    }
  }

  async function handleAIReview() {
    if (!triggerAIReview) return;
    setTriggeringAI(true);
    setActionError(null);
    try {
      await triggerAIReview({ prId: pr._id, requestedBy: pr.authorLogin });
    } catch (e: unknown) {
      setActionError(safeErrorMessage(e, "Failed to start AI review"));
    } finally {
      setTriggeringAI(false);
    }
  }

  async function handleAISummary() {
    if (!regenerateDescription) return;
    setGeneratingAISummary(true);
    setActionError(null);
    try {
      await regenerateDescription({ prId: pr._id });
    } catch (e: unknown) {
      setActionError(safeErrorMessage(e, "Failed to generate AI summary"));
    } finally {
      setGeneratingAISummary(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        {/* Header row: PR number + state badge + promote CTA */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitMergeIcon className="h-4 w-4 shrink-0 text-text-muted" />
            <span className="font-mono text-sm font-semibold text-text-primary">
              #{pr.prNumber}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateBadge.classes}`}
            >
              {stateBadge.label}
            </span>
          </div>

          {/* Promote to Ready — only for draft PRs */}
          {isDraft && !isMerged && (
            <button
              onClick={handlePromoteDraft}
              disabled={promotingDraft}
              className="btn-primary btn-sm disabled:opacity-50"
            >
              {promotingDraft ? "Promoting..." : "Promote to Ready"}
            </button>
          )}
        </div>

        {/* PR title */}
        <a
          href={pr.providerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-semibold text-text-heading hover:text-accent-default"
        >
          {pr.title}
        </a>

        {/* Branch info */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
          <GitBranchIcon className="h-3.5 w-3.5" />
          <code className="font-mono">{pr.sourceBranch}</code>
          <ArrowRightIcon className="h-3 w-3" />
          <code className="font-mono">{pr.targetBranch}</code>
        </div>

        {/* Status badges: CI, Conflicts, Reviews */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* CI status */}
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ciConfig.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${ciConfig.dot}`} />
            {ciConfig.label}
          </span>

          {/* Conflict state */}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              pr.hasConflicts
                ? "bg-status-error-bg text-status-error-fg"
                : "bg-surface-elevated text-text-secondary"
            }`}
          >
            {pr.hasConflicts ? "Conflicts" : "No conflicts"}
          </span>

          {/* Review state */}
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${reviewConfig.badge}`}>
            {reviewCount > 0
              ? `${reviewCount} review${reviewCount !== 1 ? "s" : ""}`
              : reviewConfig.label}
          </span>

          {/* Stats */}
          <span className="ml-auto flex items-center gap-2 text-xs text-text-muted">
            <span className="text-status-success-fg">+{pr.additions}</span>
            <span className="text-status-error-fg">-{pr.deletions}</span>
            <span>
              {pr.filesChanged} file{pr.filesChanged !== 1 ? "s" : ""}
            </span>
          </span>
        </div>

        {/* Action error */}
        {actionError && (
          <div className="mt-3 rounded-lg bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
            {actionError}
          </div>
        )}

        {/* Actions */}
        {!isMerged && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-default pt-4">
            {/* Edit Description */}
            <button
              onClick={() => setShowEditModal(true)}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
            >
              Edit Description
            </button>

            {/* Request Review */}
            <div className="relative">
              <button
                onClick={() => setShowReviewPopover((v) => !v)}
                disabled={isClosed}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-interactive-hover disabled:opacity-50"
              >
                Request Review
              </button>
              {showReviewPopover && (
                <RequestReviewPopover
                  prId={pr._id}
                  onClose={() => setShowReviewPopover(false)}
                  onRequest={handleRequestReview}
                />
              )}
            </div>

            {/* AI Summary — generates PR description via AI */}
            <button
              onClick={handleAISummary}
              disabled={generatingAISummary || isClosed}
              className="flex items-center gap-1.5 rounded-lg border border-status-info-border bg-status-info-bg px-3 py-1.5 text-xs font-medium text-status-info-fg transition-colors hover:opacity-80 disabled:opacity-50"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              {generatingAISummary ? "Generating..." : "AI Summary"}
            </button>

            {/* AI Review */}
            <button
              onClick={handleAIReview}
              disabled={triggeringAI || isClosed}
              className="flex items-center gap-1.5 rounded-lg border border-status-info-border bg-status-info-bg px-3 py-1.5 text-xs font-medium text-status-info-fg transition-colors hover:opacity-80 disabled:opacity-50"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              {triggeringAI ? "Reviewing..." : "AI Review"}
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Merge dropdown — only for open, non-draft PRs */}
            {!isDraft && !isClosed && <MergeDropdown onMerge={handleMerge} disabled={false} />}

            {/* Close / Reopen */}
            {!isClosed ? (
              <button
                onClick={handleClose}
                disabled={closingPR}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-status-error-border hover:bg-status-error-bg hover:text-status-error-fg disabled:opacity-50"
              >
                {closingPR ? "Closing..." : "Close"}
              </button>
            ) : (
              <button
                onClick={handleReopen}
                disabled={reopeningPR}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-interactive-hover disabled:opacity-50"
              >
                {reopeningPR ? "Reopening..." : "Reopen"}
              </button>
            )}
          </div>
        )}

        {/* Merged state footer */}
        {isMerged && (
          <div className="mt-4 flex items-center gap-2 border-t border-border-default pt-4">
            <span className="text-xs text-text-secondary">
              Merged by {pr.authorLogin}
              {pr.mergedAt
                ? ` · ${new Date(pr.mergedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
            </span>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditModal && (
        <EditDescriptionModal
          prId={pr._id}
          initialBody={pr.body ?? ""}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditDescription}
        />
      )}
    </>
  );
}
