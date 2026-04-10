"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useState } from "react";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";
type Effort = "low" | "medium" | "high" | "very_high";
type DeliveryPhase = "phase_1" | "phase_2" | "phase_3";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";

interface CreateRequirementFormProps {
  programId: string;
  workstreams: Array<{ _id: string; name: string }>;
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "must_have", label: "Must Have" },
  { value: "should_have", label: "Should Have" },
  { value: "nice_to_have", label: "Nice to Have" },
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

export function CreateRequirementForm({
  programId,
  workstreams,
  isOpen,
  onClose,
}: CreateRequirementFormProps) {
  const { organization } = useOrganization();
  const createRequirement = useMutation("requirements:create" as any);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("must_have");
  const [fitGap, setFitGap] = useState<FitGap>("native");
  const [batch, setBatch] = useState("");
  const [effortEstimate, setEffortEstimate] = useState("");
  const [deliveryPhase, setDeliveryPhase] = useState("");
  const [workstreamId, setWorkstreamId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("must_have");
    setFitGap("native");
    setBatch("");
    setEffortEstimate("");
    setDeliveryPhase("");
    setWorkstreamId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!organization?.id) {
      setError("No organization selected");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const args: Record<string, any> = {
        orgId: organization.id,
        programId,
        title: title.trim(),
        priority,
        fitGap,
      };

      if (description.trim()) args.description = description.trim();
      if (batch.trim()) args.batch = batch.trim();
      if (effortEstimate) args.effortEstimate = effortEstimate;
      if (deliveryPhase) args.deliveryPhase = deliveryPhase;
      if (workstreamId) args.workstreamId = workstreamId;

      await createRequirement(args as Parameters<typeof createRequirement>[0]);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create requirement");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={() => {
          resetForm();
          onClose();
        }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-xl border border-border-default bg-surface-default p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-heading">Create Requirement</h3>
            <button
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
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

          {error && (
            <div className="mb-4 rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="form-label">
                Title <span className="text-status-error-fg">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Product catalog data migration"
                className="input w-full"
              />
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detailed requirement description..."
                className="textarea w-full"
              />
            </div>

            {/* Two-column grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">
                  Priority <span className="text-status-error-fg">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
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
                <label className="form-label">
                  Fit/Gap <span className="text-status-error-fg">*</span>
                </label>
                <select
                  value={fitGap}
                  onChange={(e) => setFitGap(e.target.value as FitGap)}
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
                <label className="form-label">Batch</label>
                <input
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="e.g. Batch 1"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="form-label">Effort</label>
                <select
                  value={effortEstimate}
                  onChange={(e) => setEffortEstimate(e.target.value)}
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
                <label className="form-label">Delivery Phase</label>
                <select
                  value={deliveryPhase}
                  onChange={(e) => setDeliveryPhase(e.target.value)}
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
                <label className="form-label">Workstream</label>
                <select
                  value={workstreamId}
                  onChange={(e) => setWorkstreamId(e.target.value)}
                  className="select w-full"
                >
                  <option value="">Unassigned</option>
                  {workstreams.map((ws) => (
                    <option key={ws._id} value={ws._id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isSubmitting}
                className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Requirement"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
