"use client";

import { useOrganization } from "@clerk/nextjs";
import { useProgramContext } from "@foundry/ui/programs";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { IntegrationFlowDiagram } from "./IntegrationFlowDiagram";

type IntegrationType = "api" | "webhook" | "file_transfer" | "database" | "middleware" | "other";
type IntegrationStatus = "planned" | "in_progress" | "testing" | "live" | "deprecated";

const TYPE_OPTIONS: { value: IntegrationType; label: string }[] = [
  { value: "api", label: "API" },
  { value: "webhook", label: "Webhook" },
  { value: "file_transfer", label: "File Transfer" },
  { value: "database", label: "Database" },
  { value: "middleware", label: "Middleware" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: { value: IntegrationStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "testing", label: "Testing" },
  { value: "live", label: "Live" },
  { value: "deprecated", label: "Deprecated" },
];

const TYPE_BADGE: Record<IntegrationType, string> = {
  api: "badge badge-info",
  webhook: "badge badge-success",
  file_transfer: "badge badge-warning",
  database: "badge badge-warning",
  middleware: "badge badge-error",
  other: "badge",
};

const TYPE_LABEL: Record<IntegrationType, string> = {
  api: "API",
  webhook: "Webhook",
  file_transfer: "File Transfer",
  database: "Database",
  middleware: "Middleware",
  other: "Other",
};

const STATUS_BADGE: Record<IntegrationStatus, string> = {
  planned: "badge",
  in_progress: "badge badge-warning",
  testing: "badge badge-info",
  live: "badge badge-success",
  deprecated: "badge badge-error",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  testing: "Testing",
  live: "Live",
  deprecated: "Deprecated",
};

type EditingField = "name" | "sourceSystem" | "targetSystem" | "description" | "notes" | null;

export default function IntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const integrationId = params.integrationId as string;
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();

  const integration = useQuery(
    "integrations:get" as any,
    integrationId ? { integrationId } : "skip",
  );
  const allRequirements = useQuery(
    "requirements:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const updateIntegration = useMutation("integrations:update" as any);
  const updateStatus = useMutation("integrations:updateStatus" as any);
  const linkRequirement = useMutation("integrations:linkRequirement" as any);
  const unlinkRequirement = useMutation("integrations:unlinkRequirement" as any);
  const removeIntegration = useMutation("integrations:remove" as any);

  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState("");
  const [showReqSearch, setShowReqSearch] = useState(false);
  const [reqSearchQuery, setReqSearchQuery] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (integration === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading integration...</p>
      </div>
    );
  }

  if (integration === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Integration not found</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-accent-default hover:text-accent-strong"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  function startEdit(field: EditingField) {
    if (!field || !integration) return;
    const value =
      field === "name"
        ? integration.name
        : field === "sourceSystem"
          ? integration.sourceSystem
          : field === "targetSystem"
            ? integration.targetSystem
            : field === "description"
              ? (integration.description ?? "")
              : (integration.notes ?? "");
    setEditValue(value);
    setEditingField(field);
  }

  async function saveEdit() {
    if (!editingField || !integration) return;
    const trimmed = editValue.trim();
    if (
      (editingField === "name" ||
        editingField === "sourceSystem" ||
        editingField === "targetSystem") &&
      !trimmed
    ) {
      return;
    }

    await updateIntegration({
      integrationId,
      [editingField]: trimmed || undefined,
    });
    setEditingField(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  async function handleStatusChange(newStatus: IntegrationStatus) {
    await updateStatus({
      integrationId,
      status: newStatus,
    });
  }

  async function handleTypeChange(newType: IntegrationType) {
    await updateIntegration({
      integrationId,
      type: newType,
    });
  }

  function handleLinkRequirement(reqId: string) {
    linkRequirement({
      integrationId,
      requirementId: reqId,
    });
    setShowReqSearch(false);
    setReqSearchQuery("");
  }

  function handleUnlinkRequirement(reqId: string) {
    unlinkRequirement({
      integrationId,
      requirementId: reqId,
    });
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removeIntegration({ integrationId });
      router.push(`/${slug}/integrations`);
    } catch (err) {
      console.error("Failed to delete:", err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const linkedReqIds = new Set(integration.resolvedRequirements?.map((r: any) => r._id) ?? []);
  const filteredReqOptions = (allRequirements ?? []).filter(
    (r: any) =>
      !linkedReqIds.has(r._id) &&
      (reqSearchQuery === "" ||
        r.refId.toLowerCase().includes(reqSearchQuery.toLowerCase()) ||
        r.title.toLowerCase().includes(reqSearchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${slug}/integrations`)}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            {editingField === "name" ? (
              <div className="flex items-center gap-2">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="input text-2xl font-bold"
                />
                <button
                  onClick={saveEdit}
                  className="rounded p-1 text-status-success-fg hover:bg-status-success-bg"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded p-1 text-text-muted hover:bg-interactive-hover"
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
            ) : (
              <h1
                onClick={() => startEdit("name")}
                className="cursor-pointer text-2xl font-bold text-text-primary hover:text-accent-default"
                title="Click to edit"
              >
                {integration.name}
              </h1>
            )}
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[integration.status as IntegrationStatus]}`}
              >
                {STATUS_LABEL[integration.status as IntegrationStatus]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[integration.type as IntegrationType]}`}
              >
                {TYPE_LABEL[integration.type as IntegrationType]}
              </span>
            </div>
          </div>
        </div>

        {/* Delete button -- only for planned status */}
        {integration.status === "planned" && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-status-error-border px-3 py-1.5 text-sm font-medium text-status-error-fg transition-colors hover:bg-status-error-bg"
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
            Delete
          </button>
        )}
      </div>

      {/* Flow diagram */}
      <div className="card p-4">
        <IntegrationFlowDiagram
          sourceSystem={integration.sourceSystem}
          targetSystem={integration.targetSystem}
          type={integration.type}
        />
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: details */}
        <div className="space-y-4 lg:col-span-2">
          {/* Metadata card */}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">Details</h2>
            <div className="space-y-3">
              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Type</label>
                <select
                  value={integration.type}
                  onChange={(e) => handleTypeChange(e.target.value as IntegrationType)}
                  className="select w-full"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Status</label>
                <select
                  value={integration.status}
                  onChange={(e) => handleStatusChange(e.target.value as IntegrationStatus)}
                  className="select w-full"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source system */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Source System
                </label>
                {editingField === "sourceSystem" ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="input w-full"
                    />
                    <button
                      onClick={saveEdit}
                      className="shrink-0 rounded p-1 text-status-success-fg hover:bg-status-success-bg"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="shrink-0 rounded p-1 text-text-muted hover:bg-interactive-hover"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <p
                    onClick={() => startEdit("sourceSystem")}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-interactive-hover"
                    title="Click to edit"
                  >
                    {integration.sourceSystem}
                  </p>
                )}
              </div>

              {/* Target system */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Target System
                </label>
                {editingField === "targetSystem" ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="input w-full"
                    />
                    <button
                      onClick={saveEdit}
                      className="shrink-0 rounded p-1 text-status-success-fg hover:bg-status-success-bg"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="shrink-0 rounded p-1 text-text-muted hover:bg-interactive-hover"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <p
                    onClick={() => startEdit("targetSystem")}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-interactive-hover"
                    title="Click to edit"
                  >
                    {integration.targetSystem}
                  </p>
                )}
              </div>

              {/* Owner */}
              {integration.ownerName && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Owner</label>
                  <p className="text-sm text-text-secondary">{integration.ownerName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Description card */}
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Description</h2>
              {editingField !== "description" && (
                <button
                  onClick={() => startEdit("description")}
                  className="text-xs font-medium text-accent-default hover:text-accent-strong"
                >
                  Edit
                </button>
              )}
            </div>
            {editingField === "description" ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                  className="textarea w-full"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                  <button onClick={saveEdit} className="btn-primary btn-sm">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                {integration.description || "No description provided."}
              </p>
            )}
          </div>

          {/* Notes card */}
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Notes</h2>
              {editingField !== "notes" && (
                <button
                  onClick={() => startEdit("notes")}
                  className="text-xs font-medium text-accent-default hover:text-accent-strong"
                >
                  Edit
                </button>
              )}
            </div>
            {editingField === "notes" ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                  className="textarea w-full"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                  <button onClick={saveEdit} className="btn-primary btn-sm">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">{integration.notes || "No notes."}</p>
            )}
          </div>
        </div>

        {/* Right column: linked requirements */}
        <div>
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">
                Linked Requirements ({integration.resolvedRequirements?.length ?? 0})
              </h2>
              <button
                onClick={() => setShowReqSearch(!showReqSearch)}
                className="text-xs font-medium text-accent-default hover:text-accent-strong"
              >
                {showReqSearch ? "Cancel" : "+ Link"}
              </button>
            </div>

            {showReqSearch && (
              <div className="mb-3">
                <input
                  value={reqSearchQuery}
                  onChange={(e) => setReqSearchQuery(e.target.value)}
                  placeholder="Search requirements..."
                  className="input mb-1 w-full"
                />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border-default">
                  {filteredReqOptions.slice(0, 10).map((r: any) => (
                    <button
                      key={r._id}
                      onClick={() => handleLinkRequirement(r._id)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-interactive-hover"
                    >
                      <span className="font-mono text-xs text-text-muted">{r.refId}</span>
                      <span className="truncate text-text-secondary">{r.title}</span>
                    </button>
                  ))}
                  {filteredReqOptions.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-text-muted">No matching requirements</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {(integration.resolvedRequirements ?? []).map((req: any) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between rounded-lg bg-surface-raised px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-mono text-xs text-text-muted">{req.refId}</span>
                    <span className="truncate text-xs text-text-secondary">{req.title}</span>
                  </div>
                  <button
                    onClick={() => handleUnlinkRequirement(req._id)}
                    className="ml-1 shrink-0 text-text-muted hover:text-status-error-fg"
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
                </div>
              ))}
              {(integration.resolvedRequirements ?? []).length === 0 && !showReqSearch && (
                <p className="text-xs text-text-muted">No linked requirements</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Delete Integration</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Are you sure you want to delete &quot;{integration.name}&quot;? This action cannot
                be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
