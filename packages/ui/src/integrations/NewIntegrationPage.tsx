"use client";

import { useOrganization } from "@clerk/nextjs";
import { useProgramContext } from "@foundry/ui/programs";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export default function NewIntegrationPage() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const createIntegration = useMutation("integrations:create" as any);

  const [name, setName] = useState("");
  const [type, setType] = useState<IntegrationType>("api");
  const [sourceSystem, setSourceSystem] = useState("");
  const [targetSystem, setTargetSystem] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<IntegrationStatus>("planned");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !sourceSystem.trim() || !targetSystem.trim()) return;
    if (!organization?.id) {
      setError("No organization selected");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createIntegration({
        orgId: organization.id,
        programId,
        name: name.trim(),
        type,
        sourceSystem: sourceSystem.trim(),
        targetSystem: targetSystem.trim(),
        description: description.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      });
      router.push(`/${slug}/integrations`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create integration");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto container space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
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
        <h1 className="type-display-m text-text-heading">Add Integration</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-6">
          {/* Name */}
          <div className="mb-4">
            <label className="form-label">
              Integration Name <span className="text-status-error-fg">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Order Sync API"
              className="input w-full"
            />
          </div>

          {/* Type + Status */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Type <span className="text-status-error-fg">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as IntegrationType)}
                className="select w-full"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IntegrationStatus)}
                className="select w-full"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Source + Target */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Source System <span className="text-status-error-fg">*</span>
              </label>
              <input
                value={sourceSystem}
                onChange={(e) => setSourceSystem(e.target.value)}
                required
                placeholder="e.g. Magento 2"
                className="input w-full"
              />
            </div>
            <div>
              <label className="form-label">
                Target System <span className="text-status-error-fg">*</span>
              </label>
              <input
                value={targetSystem}
                onChange={(e) => setTargetSystem(e.target.value)}
                required
                placeholder="e.g. Salesforce B2B Commerce"
                className="input w-full"
              />
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this integration does and any key details..."
              className="textarea w-full"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes or considerations..."
              className="textarea w-full"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !sourceSystem.trim() || !targetSystem.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Integration"}
          </button>
        </div>
      </form>
    </div>
  );
}
