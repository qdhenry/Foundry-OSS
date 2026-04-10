"use client";

import { useEffect, useMemo, useState } from "react";

export type MergeStrategy = "append_description" | "replace_description" | "update_fields";

interface RequirementOption {
  _id: string;
  refId: string;
  title: string;
}

interface MergeableFindingCardProps {
  finding: any;
  requirements: RequirementOption[];
  isBusy?: boolean;
  isMerged?: boolean;
  onApprove: (findingId: string) => Promise<void> | void;
  onReject: (findingId: string) => Promise<void> | void;
  onMerge: (
    findingId: string,
    requirementId: string,
    strategy: MergeStrategy,
  ) => Promise<void> | void;
}

function getTitle(data: Record<string, unknown>) {
  if (typeof data.title === "string") return data.title;
  if (typeof data.name === "string") return data.name;
  if (typeof data.action === "string") return data.action;
  return "Untitled";
}

function getDescription(data: Record<string, unknown>) {
  if (typeof data.description === "string") return data.description;
  return "";
}

export function MergeableFindingCard({
  finding,
  requirements,
  isBusy,
  isMerged,
  onApprove,
  onReject,
  onMerge,
}: MergeableFindingCardProps) {
  const [showMergeControls, setShowMergeControls] = useState(false);
  const [strategy, setStrategy] = useState<MergeStrategy>("append_description");

  const data = (finding.editedData ?? finding.data ?? {}) as Record<string, unknown>;
  const title = getTitle(data);
  const description = getDescription(data);

  const potentialMatch =
    typeof data.potentialMatch === "string" && data.potentialMatch.trim().length > 0
      ? data.potentialMatch.trim()
      : null;

  const defaultTarget = useMemo(() => {
    if (!potentialMatch) return requirements[0]?._id ?? "";
    const byExact = requirements.find(
      (req) => req.title.toLowerCase() === potentialMatch.toLowerCase(),
    );
    if (byExact) return byExact._id;
    const byPartial = requirements.find((req) =>
      req.title.toLowerCase().includes(potentialMatch.toLowerCase()),
    );
    return byPartial?._id ?? requirements[0]?._id ?? "";
  }, [potentialMatch, requirements]);

  const [targetRequirementId, setTargetRequirementId] = useState(defaultTarget);
  useEffect(() => {
    setTargetRequirementId(defaultTarget);
  }, [defaultTarget]);

  const lockInfo = (() => {
    const edited = finding?.editedData;
    if (!edited || typeof edited !== "object") return null;
    const lock = (edited as Record<string, unknown>).__lock;
    if (!lock || typeof lock !== "object") return null;
    const expiresAt = (lock as Record<string, unknown>).expiresAt;
    const userName = (lock as Record<string, unknown>).userName;
    if (typeof expiresAt !== "number" || expiresAt < Date.now()) return null;
    return {
      userName: typeof userName === "string" ? userName : "another user",
    };
  })();

  const statusTone: Record<string, string> = {
    pending: "bg-surface-elevated text-text-secondary",
    approved: "bg-status-success-bg text-status-success-fg",
    rejected: "bg-status-error-bg text-status-error-fg",
    edited: "bg-status-info-bg text-status-info-fg",
    imported: "bg-status-success-bg text-status-success-fg",
  };

  const isPending = finding.status === "pending";

  return (
    <article className="rounded-xl border border-border-default bg-surface-default p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
          {finding.type.replace("_", " ")}
        </span>
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
          {finding.confidence}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone[finding.status] ?? statusTone.pending}`}
        >
          {finding.status}
        </span>
        {finding.documentName && (
          <span className="ml-auto truncate text-xs text-text-secondary">
            {finding.documentName}
          </span>
        )}
      </div>

      <h4 className="text-sm font-semibold text-text-heading">{title}</h4>
      {description && <p className="mt-1 line-clamp-3 text-sm text-text-primary">{description}</p>}

      {potentialMatch && (
        <div className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg">
          Potential match: <span className="font-semibold">{potentialMatch}</span>
          <button
            type="button"
            onClick={() => setShowMergeControls((prev) => !prev)}
            className="ml-2 font-semibold underline-offset-2 hover:underline"
          >
            {showMergeControls ? "Hide merge" : "Merge into existing"}
          </button>
        </div>
      )}

      {lockInfo && (
        <div className="mt-3 rounded-lg border border-status-info-border bg-status-info-bg px-3 py-2 text-xs text-status-info-fg">
          Being reviewed by {lockInfo.userName}
        </div>
      )}

      {showMergeControls && potentialMatch && (
        <div className="mt-3 grid gap-2 rounded-lg border border-border-default bg-surface-raised p-3">
          <label className="grid gap-1 text-xs">
            <span className="text-text-secondary">Target requirement</span>
            <select
              value={targetRequirementId}
              onChange={(event) => setTargetRequirementId(event.target.value)}
              className="rounded border border-border-default bg-surface-default px-2 py-1 text-xs"
            >
              {requirements.map((req) => (
                <option key={req._id} value={req._id}>
                  {req.refId} · {req.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs">
            <span className="text-text-secondary">Merge strategy</span>
            <select
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as MergeStrategy)}
              className="rounded border border-border-default bg-surface-default px-2 py-1 text-xs"
            >
              <option value="append_description">Append finding detail</option>
              <option value="replace_description">Replace description</option>
              <option value="update_fields">Update mapped fields</option>
            </select>
          </label>

          <button
            type="button"
            disabled={!targetRequirementId || isBusy || Boolean(lockInfo)}
            onClick={() => onMerge(finding._id, targetRequirementId, strategy)}
            className="mt-1 justify-self-start rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-60"
          >
            {isBusy ? "Merging..." : "Merge & Resolve"}
          </button>
        </div>
      )}

      {finding.sourceExcerpt && (
        <blockquote className="mt-3 rounded-lg border-l-2 border-border-default bg-surface-raised px-3 py-2 text-xs italic text-text-secondary">
          {finding.sourceExcerpt}
        </blockquote>
      )}

      <div className="mt-3 flex items-center gap-2">
        {isPending && (
          <>
            <button
              type="button"
              onClick={() => onApprove(finding._id)}
              disabled={isBusy || Boolean(lockInfo)}
              className="rounded-lg bg-status-success-fg px-3 py-1.5 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onReject(finding._id)}
              disabled={isBusy || Boolean(lockInfo)}
              className="rounded-lg bg-status-error-fg px-3 py-1.5 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-60"
            >
              Reject
            </button>
          </>
        )}
        {isMerged && (
          <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
            Merged
          </span>
        )}
      </div>
    </article>
  );
}
