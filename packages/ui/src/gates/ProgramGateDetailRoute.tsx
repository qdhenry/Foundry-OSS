"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useProgramContext } from "../programs";
import { ApprovalPanel } from "./ApprovalPanel";
import { CodeEvidenceSection } from "./CodeEvidenceSection";
import { CriteriaChecklist } from "./CriteriaChecklist";
import { SprintGateEvaluator } from "./SprintGateEvaluator";

type GateType = "foundation" | "development" | "integration" | "release";
type GateStatus = "pending" | "passed" | "failed" | "overridden";

const TYPE_BADGE: Record<GateType, string> = {
  foundation: "badge",
  development: "badge badge-info",
  integration: "badge badge-success",
  release: "badge badge-warning",
};

const TYPE_LABEL: Record<GateType, string> = {
  foundation: "Foundation",
  development: "Development",
  integration: "Integration",
  release: "Release",
};

const STATUS_BADGE: Record<GateStatus, string> = {
  pending: "badge badge-warning",
  passed: "badge badge-success",
  failed: "badge badge-error",
  overridden: "badge badge-warning",
};

const STATUS_LABEL: Record<GateStatus, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  overridden: "Overridden",
};

export function ProgramGateDetailRoute() {
  const params = useParams();
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const gateId = params.gateId as string;

  const gate = useQuery("sprintGates:get" as any, gateId ? { gateId: gateId as any } : "skip");
  const workstream = useQuery(
    "workstreams:get" as any,
    gate?.workstreamId ? { workstreamId: gate.workstreamId as any } : "skip",
  );

  const finalizeGate = useMutation("sprintGates:finalize" as any);
  const overrideGate = useMutation("sprintGates:override" as any);
  const removeGate = useMutation("sprintGates:remove" as any);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (gate === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading gate...</p>
      </div>
    );
  }

  if (gate === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Gate not found</p>
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

  const gateSprintId = (gate as any).sprintId as string | undefined;

  const isEditable = gate.status === "pending";
  const allCriteriaPassed = gate.criteria.every((c: { passed: boolean }) => c.passed);
  const allApprovalsApproved =
    gate.approvals.length > 0 &&
    gate.approvals.every((a: { status: string }) => a.status === "approved");
  const canFinalize = isEditable && gate.criteria.length > 0;

  async function handleFinalize() {
    setIsFinalizing(true);
    try {
      await finalizeGate({ gateId: gateId as any });
    } finally {
      setIsFinalizing(false);
    }
  }

  async function handleOverride() {
    setIsOverriding(true);
    try {
      await overrideGate({ gateId: gateId as any });
      setShowOverrideConfirm(false);
    } finally {
      setIsOverriding(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removeGate({ gateId: gateId as any });
      router.push(`/${slug}/gates`);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push(`/${slug}/gates`)}
        className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-secondary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Gates
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="type-display-m text-text-heading">{gate.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[gate.status as GateStatus]}`}
            >
              {STATUS_LABEL[gate.status as GateStatus]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-text-secondary">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[gate.gateType as GateType]}`}
            >
              {TYPE_LABEL[gate.gateType as GateType]}
            </span>
            {workstream && <span>{workstream.name}</span>}
            {gate.evaluatedAt && (
              <span>Evaluated {new Date(gate.evaluatedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {gate.status === "pending" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-status-error-fg transition-colors hover:bg-status-error-bg"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Main content: two columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Criteria -- 2/3 width */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Criteria</h2>
            <CriteriaChecklist gateId={gateId} criteria={gate.criteria} isEditable={isEditable} />
          </div>

          {/* AI Insights: Sprint Gate Evaluator */}
          {gateSprintId && (
            <div className="card mt-6 p-5">
              <SprintGateEvaluator sprintId={gateSprintId} programId={programId} />
            </div>
          )}

          {/* Code Evidence from Source Control */}
          <div className="mt-6">
            <CodeEvidenceSection gateId={gateId} sprintId={gateSprintId} programId={programId} />
          </div>
        </div>

        {/* Sidebar -- approvals + actions */}
        <div className="space-y-4">
          {/* Approvals */}
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Approvals</h2>
            <ApprovalPanel gateId={gateId} approvals={gate.approvals} isEditable={isEditable} />
          </div>

          {/* Gate actions */}
          {isEditable && (
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Actions</h2>
              <div className="space-y-3">
                {/* Finalize */}
                <button
                  onClick={handleFinalize}
                  disabled={!canFinalize || isFinalizing}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {isFinalizing ? "Evaluating..." : "Finalize Gate"}
                </button>
                {canFinalize && (
                  <p className="text-xs text-text-muted">
                    {allCriteriaPassed && allApprovalsApproved
                      ? "All criteria passed and approvals granted. Gate will pass."
                      : !allCriteriaPassed
                        ? "Some criteria not yet passed. Gate will fail."
                        : "Approvals not yet complete. Gate will fail."}
                  </p>
                )}

                {/* Override */}
                <button
                  onClick={() => setShowOverrideConfirm(true)}
                  className="btn-secondary w-full border-status-warning-border text-status-warning-fg hover:bg-status-warning-bg"
                >
                  Override Gate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Override confirmation modal */}
      {showOverrideConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowOverrideConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-text-primary">Override Gate?</h3>
              <p className="mt-2 text-sm text-text-secondary">
                This will mark the gate as overridden, bypassing criteria and approval checks. This
                action should only be used for exceptional cases.
              </p>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowOverrideConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  disabled={isOverriding}
                  className="rounded-lg bg-status-warning-fg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {isOverriding ? "Overriding..." : "Override"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-text-primary">Delete Gate?</h3>
              <p className="mt-2 text-sm text-text-secondary">
                This will permanently delete this sprint gate. This action cannot be undone.
              </p>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
