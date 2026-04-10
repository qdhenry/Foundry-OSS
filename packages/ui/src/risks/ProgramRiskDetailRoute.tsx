"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useProgramContext } from "../programs";
import { RiskMatrix } from "./RiskMatrix";

type Severity = "critical" | "high" | "medium" | "low";
type Probability = "very_likely" | "likely" | "possible" | "unlikely";
type Status = "open" | "mitigating" | "resolved" | "accepted";

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PROBABILITY_OPTIONS: { value: Probability; label: string }[] = [
  { value: "very_likely", label: "Very Likely" },
  { value: "likely", label: "Likely" },
  { value: "possible", label: "Possible" },
  { value: "unlikely", label: "Unlikely" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Mitigating" },
  { value: "resolved", label: "Resolved" },
  { value: "accepted", label: "Accepted" },
];

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "badge badge-error",
  high: "badge badge-warning",
  medium: "badge badge-warning",
  low: "badge badge-success",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_BADGE: Record<Status, string> = {
  open: "badge badge-info",
  mitigating: "badge badge-warning",
  resolved: "badge badge-success",
  accepted: "badge",
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  mitigating: "Mitigating",
  resolved: "Resolved",
  accepted: "Accepted",
};

type RiskRecord = {
  _id: string;
  _creationTime: number;
  title: string;
  description?: string;
  mitigation?: string;
  severity: Severity;
  probability: Probability;
  status: Status;
  ownerName?: string;
  workstreamIds?: string[];
};

type WorkstreamRecord = {
  _id: string;
  name: string;
  shortCode: string;
};

export function ProgramRiskDetailRoute() {
  const params = useParams();
  const router = useRouter();
  const riskId = params.riskId as string;
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();

  const risk = useQuery("risks:get" as any, riskId ? { riskId: riskId as any } : "skip") as
    | RiskRecord
    | null
    | undefined;
  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as WorkstreamRecord[] | undefined;

  const updateRisk = useMutation("risks:update" as any);
  const updateStatus = useMutation("risks:updateStatus" as any);
  const removeRisk = useMutation("risks:remove" as any);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [isEditingMitigation, setIsEditingMitigation] = useState(false);
  const [editMitigation, setEditMitigation] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (risk === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading risk...</p>
      </div>
    );
  }

  if (risk === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Risk not found</p>
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

  async function handleTitleSave() {
    if (!editTitle.trim()) return;
    await updateRisk({ riskId: riskId as any, title: editTitle.trim() });
    setIsEditingTitle(false);
  }

  async function handleDescSave() {
    await updateRisk({
      riskId: riskId as any,
      description: editDesc.trim() || undefined,
    });
    setIsEditingDesc(false);
  }

  async function handleMitigationSave() {
    await updateRisk({
      riskId: riskId as any,
      mitigation: editMitigation.trim() || undefined,
    });
    setIsEditingMitigation(false);
  }

  async function handleSeverityChange(sev: Severity) {
    await updateRisk({ riskId: riskId as any, severity: sev });
  }

  async function handleProbabilityChange(prob: Probability) {
    await updateRisk({ riskId: riskId as any, probability: prob });
  }

  async function handleStatusChange(newStatus: Status) {
    await updateStatus({ riskId: riskId as any, status: newStatus });
  }

  async function handleWorkstreamToggle(wsId: string) {
    if (!risk) return;
    const current = risk.workstreamIds ?? [];
    const updated = current.includes(wsId)
      ? current.filter((id) => id !== wsId)
      : [...current, wsId];
    await updateRisk({
      riskId: riskId as any,
      workstreamIds: updated as any,
    });
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removeRisk({ riskId: riskId as any });
      router.push(`/${slug}/risks`);
    } catch (err) {
      console.error("Failed to delete risk:", err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push(`/${slug}/risks`)}
            className="mt-1 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
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
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="input w-full text-lg font-bold"
                />
                <button onClick={handleTitleSave} className="btn-primary btn-sm">
                  Save
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-interactive-hover"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                onClick={() => {
                  setEditTitle(risk.title);
                  setIsEditingTitle(true);
                }}
                className="cursor-pointer text-2xl font-bold text-text-primary hover:text-accent-default"
                title="Click to edit"
              >
                {risk.title}
              </h1>
            )}

            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[risk.severity as Severity]}`}
              >
                {SEVERITY_LABEL[risk.severity as Severity]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[risk.status as Status]}`}
              >
                {STATUS_LABEL[risk.status as Status]}
              </span>
              {risk.ownerName && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {risk.ownerName}
                </span>
              )}
            </div>
          </div>
        </div>

        {risk.status === "open" && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
            title="Delete risk"
          >
            <svg
              className="h-5 w-5"
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
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary">Description</h2>
              {!isEditingDesc && (
                <button
                  onClick={() => {
                    setEditDesc(risk.description ?? "");
                    setIsEditingDesc(true);
                  }}
                  className="text-xs font-medium text-accent-default hover:text-accent-strong"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className="textarea w-full"
                />
                <div className="flex items-center gap-2">
                  <button onClick={handleDescSave} className="btn-primary btn-sm">
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                {risk.description || "No description provided."}
              </p>
            )}
          </div>

          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary">Mitigation Plan</h2>
              {!isEditingMitigation && (
                <button
                  onClick={() => {
                    setEditMitigation(risk.mitigation ?? "");
                    setIsEditingMitigation(true);
                  }}
                  className="text-xs font-medium text-accent-default hover:text-accent-strong"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingMitigation ? (
              <div className="space-y-2">
                <textarea
                  value={editMitigation}
                  onChange={(e) => setEditMitigation(e.target.value)}
                  rows={6}
                  placeholder="Describe the mitigation strategy..."
                  className="textarea w-full"
                />
                <div className="flex items-center gap-2">
                  <button onClick={handleMitigationSave} className="btn-primary btn-sm">
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingMitigation(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {risk.mitigation || "No mitigation plan defined yet."}
              </p>
            )}
          </div>

          <div className="card p-5">
            <RiskMatrix
              severity={risk.severity as Severity}
              probability={risk.probability as Probability}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Status</label>
            <select
              value={risk.status}
              onChange={(e) => handleStatusChange(e.target.value as Status)}
              className="select w-full"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="card p-4">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Severity</label>
            <select
              value={risk.severity}
              onChange={(e) => handleSeverityChange(e.target.value as Severity)}
              className="select w-full"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="card p-4">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Probability</label>
            <select
              value={risk.probability}
              onChange={(e) => handleProbabilityChange(e.target.value as Probability)}
              className="select w-full"
            >
              {PROBABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="card p-4">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Linked Workstreams
            </label>
            {workstreams === undefined ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : workstreams.length === 0 ? (
              <p className="text-xs text-text-muted">No workstreams available</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {workstreams.map((ws) => {
                  const isLinked = (risk.workstreamIds ?? []).includes(ws._id);
                  return (
                    <button
                      key={ws._id}
                      onClick={() => handleWorkstreamToggle(ws._id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        isLinked
                          ? "bg-interactive-subtle text-accent-default"
                          : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
                      }`}
                    >
                      {ws.shortCode}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-4">
            <label className="mb-1 block text-xs font-medium text-text-muted">Created</label>
            <p className="text-sm text-text-secondary">
              {new Date(risk._creationTime).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Delete Risk</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Are you sure you want to delete &ldquo;{risk.title}&rdquo;? This action cannot be
                undone.
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
