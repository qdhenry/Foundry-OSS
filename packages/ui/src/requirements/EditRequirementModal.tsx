"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";
type Effort = "low" | "medium" | "high" | "very_high";
type DeliveryPhase = "phase_1" | "phase_2" | "phase_3";

const PRIORITY_LABELS: Record<Priority, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In Progress",
  complete: "Complete",
  deferred: "Deferred",
};

const FIT_GAP_LABELS: Record<FitGap, string> = {
  native: "Native",
  config: "Configuration",
  custom_dev: "Custom Development",
  third_party: "Third Party",
  not_feasible: "Not Feasible",
};

const EFFORT_LABELS: Record<Effort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
};

const DELIVERY_PHASE_LABELS: Record<DeliveryPhase, string> = {
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  phase_3: "Phase 3",
};

interface EditRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementId: string;
  initialValues: {
    priority: Priority;
    status: Status;
    fitGap: FitGap;
    effortEstimate?: Effort;
    deliveryPhase?: DeliveryPhase;
  };
}

export function EditRequirementModal({
  isOpen,
  onClose,
  requirementId,
  initialValues,
}: EditRequirementModalProps) {
  const updateRequirement = useMutation("requirements:update" as any);

  const [priority, setPriority] = useState<Priority>(initialValues.priority);
  const [status, setStatus] = useState<Status>(initialValues.status);
  const [fitGap, setFitGap] = useState<FitGap>(initialValues.fitGap);
  const [effortEstimate, setEffortEstimate] = useState<Effort | "">(
    initialValues.effortEstimate ?? "",
  );
  const [deliveryPhase, setDeliveryPhase] = useState<DeliveryPhase | "">(
    initialValues.deliveryPhase ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPriority(initialValues.priority);
      setStatus(initialValues.status);
      setFitGap(initialValues.fitGap);
      setEffortEstimate(initialValues.effortEstimate ?? "");
      setDeliveryPhase(initialValues.deliveryPhase ?? "");
      setIsSaving(false);
    }
  }, [isOpen, initialValues]);

  // Escape key closes modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  async function handleSave() {
    setIsSaving(true);

    // Only send fields that actually changed
    const changedFields: Record<string, string> = {};

    if (priority !== initialValues.priority) {
      changedFields.priority = priority;
    }
    if (status !== initialValues.status) {
      changedFields.status = status;
    }
    if (fitGap !== initialValues.fitGap) {
      changedFields.fitGap = fitGap;
    }

    const initialEffort = initialValues.effortEstimate ?? "";
    if (effortEstimate !== initialEffort) {
      if (effortEstimate) {
        changedFields.effortEstimate = effortEstimate;
      }
    }

    const initialPhase = initialValues.deliveryPhase ?? "";
    if (deliveryPhase !== initialPhase) {
      if (deliveryPhase) {
        changedFields.deliveryPhase = deliveryPhase;
      }
    }

    try {
      await updateRequirement({
        requirementId: requirementId as any,
        ...changedFields,
      });
      onClose();
    } catch {
      // Allow retry on failure
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="w-full max-w-md rounded-xl border border-border-default bg-surface-default shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-border-default px-6 py-4">
            <h2 className="text-lg font-semibold text-text-heading">Edit Requirement</h2>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5">
            {/* Priority */}
            <div>
              <label className="form-label">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isSaving}
                className="select w-full"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="form-label">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                disabled={isSaving}
                className="select w-full"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fit/Gap */}
            <div>
              <label className="form-label">Fit/Gap</label>
              <select
                value={fitGap}
                onChange={(e) => setFitGap(e.target.value as FitGap)}
                disabled={isSaving}
                className="select w-full"
              >
                {Object.entries(FIT_GAP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Effort Estimate (optional) */}
            <div>
              <label className="form-label">Effort Estimate</label>
              <select
                value={effortEstimate}
                onChange={(e) => setEffortEstimate(e.target.value as Effort | "")}
                disabled={isSaving}
                className="select w-full"
              >
                <option value="">Not set</option>
                {Object.entries(EFFORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Phase (optional) */}
            <div>
              <label className="form-label">Delivery Phase</label>
              <select
                value={deliveryPhase}
                onChange={(e) => setDeliveryPhase(e.target.value as DeliveryPhase | "")}
                disabled={isSaving}
                className="select w-full"
              >
                <option value="">Not set</option>
                {Object.entries(DELIVERY_PHASE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-interactive-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
