"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { RequirementRefinementPanel, TaskDecompositionPanel } from "@/components/ai-features";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CommentThread } from "../comments/CommentThread";
import { EvidenceUpload } from "./EvidenceUpload";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";
type Effort = "low" | "medium" | "high" | "very_high";
type DeliveryPhase = "phase_1" | "phase_2" | "phase_3";

interface RequirementDetailPanelProps {
  requirementId: string;
  programId: string;
  orgId: string;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "must_have", label: "Must Have" },
  { value: "should_have", label: "Should Have" },
  { value: "nice_to_have", label: "Nice to Have" },
  { value: "deferred", label: "Deferred" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "deferred", label: "Deferred" },
];

const FITGAP_OPTIONS: { value: FitGap; label: string }[] = [
  { value: "native", label: "Native" },
  { value: "config", label: "Config" },
  { value: "custom_dev", label: "Custom Dev" },
  { value: "third_party", label: "Third Party" },
  { value: "not_feasible", label: "Not Feasible" },
];

const EFFORT_OPTIONS: { value: Effort; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

const DELIVERY_OPTIONS: { value: DeliveryPhase; label: string }[] = [
  { value: "phase_1", label: "Phase 1" },
  { value: "phase_2", label: "Phase 2" },
  { value: "phase_3", label: "Phase 3" },
];

const STATUS_BADGE: Record<Status, string> = {
  draft: "bg-surface-raised text-text-secondary",
  approved: "bg-status-info-bg text-status-info-fg",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  complete: "bg-status-success-bg text-status-success-fg",
  deferred: "bg-surface-elevated text-text-secondary",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RequirementDetailPanel({
  requirementId,
  programId,
  orgId,
  onClose,
}: RequirementDetailPanelProps) {
  const requirementIdValue = requirementId as Id<"requirements">;
  const programIdValue = programId as Id<"programs">;

  const requirement = useQuery(api.requirements.get, requirementId ? { requirementId } : "skip");
  const workstreams = useQuery(api.workstreams.listByProgram, programId ? { programId } : "skip");
  const allRequirements = useQuery(
    api.requirements.listByProgram,
    programId ? { programId } : "skip",
  );

  const updateRequirement = useMutation(api.requirements.update);
  const updateStatus = useMutation(api.requirements.updateStatus);
  const linkDependency = useMutation(api.requirements.linkDependency);
  const unlinkDependency = useMutation(api.requirements.unlinkDependency);
  const removeEvidence = useMutation(api.evidence.remove);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [showDepSearch, setShowDepSearch] = useState(false);
  const [depSearchQuery, setDepSearchQuery] = useState("");

  if (!requirement) {
    return (
      <>
        <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
        <div className="fixed top-0 right-0 z-40 flex h-full w-[480px] items-center justify-center border-l border-border-default bg-surface-default shadow-xl">
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      </>
    );
  }

  function handleFieldUpdate(field: string, value: string) {
    updateRequirement({ requirementId, [field]: value });
  }

  function handleStatusChange(status: Status) {
    updateStatus({ requirementId, status });
  }

  function handleTitleSave() {
    if (titleValue.trim() && requirement && titleValue !== requirement.title) {
      handleFieldUpdate("title", titleValue.trim());
    }
    setEditingTitle(false);
  }

  function handleDescriptionSave() {
    if (requirement && descriptionValue !== (requirement.description ?? "")) {
      handleFieldUpdate("description", descriptionValue);
    }
    setEditingDescription(false);
  }

  function handleAddDependency(depId: string) {
    linkDependency({ requirementId, dependencyId: depId });
    setShowDepSearch(false);
    setDepSearchQuery("");
  }

  function handleRemoveDependency(depId: string) {
    unlinkDependency({ requirementId, dependencyId: depId });
  }

  function handleDeleteEvidence(evidenceId: string) {
    removeEvidence({ evidenceId });
  }

  const existingDepIds = new Set(requirement.resolvedDependencies?.map((d: any) => d._id) ?? []);
  const filteredDepOptions = (allRequirements ?? []).filter(
    (r: any) =>
      r._id !== requirementId &&
      !existingDepIds.has(r._id) &&
      (depSearchQuery === "" ||
        r.refId.toLowerCase().includes(depSearchQuery.toLowerCase()) ||
        r.title.toLowerCase().includes(depSearchQuery.toLowerCase())),
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-40 flex h-full w-[480px] flex-col border-l border-border-default bg-surface-default shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default p-4">
          <div className="flex-1">
            <span className="mb-1 inline-block rounded bg-surface-raised px-2 py-0.5 font-mono text-xs text-text-secondary">
              {requirement.refId}
            </span>
            {editingTitle ? (
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                className="mt-1 block w-full rounded border border-accent-default bg-transparent px-1 text-lg font-semibold text-text-heading outline-none"
              />
            ) : (
              <h2
                onClick={() => {
                  setTitleValue(requirement.title);
                  setEditingTitle(true);
                }}
                className="mt-1 cursor-pointer text-lg font-semibold text-text-heading hover:text-accent-strong"
              >
                {requirement.title}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Status bar */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
            <select
              value={requirement.status}
              onChange={(e) => handleStatusChange(e.target.value as Status)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[requirement.status as Status]}`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Details grid */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Priority</label>
              <select
                value={requirement.priority}
                onChange={(e) => handleFieldUpdate("priority", e.target.value)}
                className="select w-full"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Fit/Gap</label>
              <select
                value={requirement.fitGap}
                onChange={(e) => handleFieldUpdate("fitGap", e.target.value)}
                className="select w-full"
              >
                {FITGAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Effort</label>
              <select
                value={requirement.effortEstimate ?? ""}
                onChange={(e) => handleFieldUpdate("effortEstimate", e.target.value)}
                className="select w-full"
              >
                <option value="">Not Set</option>
                {EFFORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Delivery Phase
              </label>
              <select
                value={requirement.deliveryPhase ?? ""}
                onChange={(e) => handleFieldUpdate("deliveryPhase", e.target.value)}
                className="select w-full"
              >
                <option value="">Not Set</option>
                {DELIVERY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Batch</label>
              <input
                defaultValue={requirement.batch ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (requirement.batch ?? "")) {
                    handleFieldUpdate("batch", e.target.value);
                  }
                }}
                className="input w-full"
                placeholder="e.g. Batch 1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Workstream
              </label>
              <select
                value={requirement.workstreamId ?? ""}
                onChange={(e) => handleFieldUpdate("workstreamId", e.target.value)}
                className="select w-full"
              >
                <option value="">Unassigned</option>
                {(workstreams ?? []).map((ws: any) => (
                  <option key={ws._id} value={ws._id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Description
            </label>
            {editingDescription ? (
              <textarea
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                onBlur={handleDescriptionSave}
                rows={4}
                className="textarea w-full border-accent-default"
              />
            ) : (
              <div
                onClick={() => {
                  setDescriptionValue(requirement.description ?? "");
                  setEditingDescription(true);
                }}
                className="min-h-[60px] cursor-pointer rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-colors hover:border-accent-default"
              >
                {requirement.description || (
                  <span className="italic text-text-muted">Click to add description...</span>
                )}
              </div>
            )}
          </div>

          {/* Dependencies */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">Dependencies</label>
              <button
                onClick={() => setShowDepSearch(!showDepSearch)}
                className="text-xs font-medium text-accent-default hover:text-accent-strong"
              >
                {showDepSearch ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showDepSearch && (
              <div className="mb-2">
                <input
                  value={depSearchQuery}
                  onChange={(e) => setDepSearchQuery(e.target.value)}
                  placeholder="Search requirements..."
                  className="input mb-1 w-full"
                />
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border-default">
                  {filteredDepOptions.slice(0, 10).map((r: any) => (
                    <button
                      key={r._id}
                      onClick={() => handleAddDependency(r._id)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-interactive-hover"
                    >
                      <span className="font-mono text-xs text-text-secondary">{r.refId}</span>
                      <span className="truncate text-text-primary">{r.title}</span>
                    </button>
                  ))}
                  {filteredDepOptions.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-text-muted">No matching requirements</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(requirement.resolvedDependencies ?? []).map((dep: any) => (
                <span
                  key={dep._id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2.5 py-1 text-xs"
                >
                  <span className="font-mono text-text-secondary">{dep.refId}</span>
                  <span className="max-w-[120px] truncate text-text-primary">{dep.title}</span>
                  <button
                    onClick={() => handleRemoveDependency(dep._id)}
                    className="ml-0.5 text-text-muted hover:text-status-error-fg"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {(requirement.resolvedDependencies ?? []).length === 0 && !showDepSearch && (
                <p className="text-xs text-text-muted">No dependencies</p>
              )}
            </div>
          </div>

          {/* Evidence */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">Evidence</label>
              <EvidenceUpload requirementId={requirementId} orgId={orgId} />
            </div>
            <div className="space-y-2">
              {(requirement.evidenceFiles ?? []).map((file: any) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg
                      className="h-4 w-4 shrink-0 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="min-w-0">
                      {file.downloadUrl ? (
                        <a
                          href={file.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm font-medium text-accent-default hover:underline"
                        >
                          {file.fileName}
                        </a>
                      ) : (
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {file.fileName}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {formatFileSize(file.fileSize)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteEvidence(file._id)}
                    className="ml-2 shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              {(requirement.evidenceFiles ?? []).length === 0 && (
                <p className="text-xs text-text-muted">No evidence files uploaded</p>
              )}
            </div>
          </div>

          {/* AI Insights: Requirement Refinement */}
          <div className="mt-6 border-t border-border-default pt-4">
            <RequirementRefinementPanel
              requirementId={requirementIdValue}
              programId={programIdValue}
            />
          </div>

          {/* AI Insights: Task Decomposition */}
          <div className="mt-6 border-t border-border-default pt-4">
            <TaskDecompositionPanel requirementId={requirementIdValue} programId={programIdValue} />
          </div>

          {/* Comments */}
          <div className="mt-6 border-t border-border-default pt-4">
            <CommentThread
              entityType="requirement"
              entityId={requirementId}
              programId={programId}
              orgId={orgId}
            />
          </div>
        </div>
      </div>
    </>
  );
}
