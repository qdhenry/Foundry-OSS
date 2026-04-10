"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

type ApprovalStatus = "pending" | "approved" | "declined";

interface Approval {
  userId: string;
  role: string;
  status: ApprovalStatus;
  timestamp?: number;
  userName: string;
}

interface ApprovalPanelProps {
  gateId: string;
  approvals: Approval[];
  isEditable: boolean;
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; classes: string; icon: string }> = {
  pending: {
    label: "Pending",
    classes: "bg-status-warning-bg text-status-warning-fg",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  approved: {
    label: "Approved",
    classes: "bg-status-success-bg text-status-success-fg",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  declined: {
    label: "Declined",
    classes: "bg-status-error-bg text-status-error-fg",
    icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function ApprovalPanel({ gateId, approvals, isEditable }: ApprovalPanelProps) {
  const addApproval = useMutation(api.sprintGates.addApproval);
  const updateApproval = useMutation(api.sprintGates.updateApproval);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleAddApproval(e: React.FormEvent) {
    e.preventDefault();
    if (!newRole.trim()) return;
    setIsSubmitting(true);
    try {
      await addApproval({ gateId: gateId as any, role: newRole.trim() });
      setNewRole("");
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateApproval(status: "approved" | "declined") {
    setUpdatingId(status);
    try {
      await updateApproval({ gateId: gateId as any, status });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      {approvals.length === 0 && !showAddForm ? (
        <div className="rounded-lg border border-dashed border-border-default px-4 py-6 text-center">
          <p className="text-sm text-text-secondary">No approvals required yet</p>
          {isEditable && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-sm font-medium text-accent-default hover:text-accent-strong"
            >
              Add Approval
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval, index) => {
            const config = STATUS_CONFIG[approval.status];
            return (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-border-default bg-surface-default p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-sm font-medium text-text-secondary">
                    {approval.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-heading">{approval.userName}</p>
                    <p className="text-xs text-text-secondary">{approval.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                    </svg>
                    {config.label}
                  </span>
                  {approval.timestamp && (
                    <span className="text-xs text-text-muted">
                      {new Date(approval.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Action buttons for current user's pending approval */}
          {isEditable && approvals.some((a) => a.status === "pending") && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleUpdateApproval("approved")}
                disabled={updatingId !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-status-success-fg px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {updatingId === "approved" ? "Approving..." : "Approve"}
              </button>
              <button
                onClick={() => handleUpdateApproval("declined")}
                disabled={updatingId !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-status-error-fg px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {updatingId === "declined" ? "Declining..." : "Decline"}
              </button>
            </div>
          )}

          {/* Add approval button */}
          {isEditable && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full rounded-lg border border-dashed border-border-default px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent-default hover:text-accent-default"
            >
              + Add Approval
            </button>
          )}

          {/* Add approval form */}
          {showAddForm && (
            <form
              onSubmit={handleAddApproval}
              className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised p-3"
            >
              <input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Role (e.g. Architect, QA Lead)"
                className="input flex-1 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={!newRole.trim() || isSubmitting}
                className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewRole("");
                }}
                className="rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:bg-interactive-hover"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
