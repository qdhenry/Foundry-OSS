"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProgramContext } from "../programs";

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

type WorkstreamRecord = {
  _id: string;
  name: string;
  shortCode: string;
};

export function ProgramRiskNewRoute() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const createRisk = useMutation("risks:create" as any);

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as WorkstreamRecord[] | undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [probability, setProbability] = useState<Probability>("possible");
  const [mitigation, setMitigation] = useState("");
  const [status, setStatus] = useState<Status>("open");
  const [selectedWorkstreamIds, setSelectedWorkstreamIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWorkstream(wsId: string) {
    setSelectedWorkstreamIds((prev) =>
      prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId],
    );
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
      await createRisk({
        orgId: organization.id,
        programId,
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        probability,
        mitigation: mitigation.trim() || undefined,
        status,
        workstreamIds:
          selectedWorkstreamIds.length > 0 ? (selectedWorkstreamIds as any) : undefined,
      });
      router.push(`/${slug}/risks`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create risk");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto container space-y-6">
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
        <h1 className="type-display-m text-text-heading">Create Risk</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-6">
          <div className="mb-4">
            <label className="form-label">
              Risk Title <span className="text-status-error-fg">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Data migration may exceed timeline due to custom field complexity"
              className="input w-full"
            />
          </div>

          <div className="mb-4">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the risk in detail..."
              className="textarea w-full"
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Severity <span className="text-status-error-fg">*</span>
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="select w-full"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">
                Probability <span className="text-status-error-fg">*</span>
              </label>
              <select
                value={probability}
                onChange={(e) => setProbability(e.target.value as Probability)}
                className="select w-full"
              >
                {PROBABILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="select w-full"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="form-label">Mitigation Plan</label>
            <textarea
              value={mitigation}
              onChange={(e) => setMitigation(e.target.value)}
              rows={4}
              placeholder="Describe the mitigation strategy..."
              className="textarea w-full"
            />
          </div>

          <div>
            <label className="form-label">Linked Workstreams</label>
            {workstreams === undefined ? (
              <p className="text-xs text-text-muted">Loading workstreams...</p>
            ) : workstreams.length === 0 ? (
              <p className="text-xs text-text-muted">No workstreams available</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {workstreams.map((ws) => {
                  const isSelected = selectedWorkstreamIds.includes(ws._id);
                  return (
                    <button
                      key={ws._id}
                      type="button"
                      onClick={() => toggleWorkstream(ws._id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-interactive-subtle text-accent-default"
                          : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
                      }`}
                    >
                      {ws.shortCode} - {ws.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

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
            disabled={!title.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Risk"}
          </button>
        </div>
      </form>
    </div>
  );
}
