"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProgramContext } from "../programs";

type GateType = "foundation" | "development" | "integration" | "release";

const GATE_TYPE_OPTIONS: { value: GateType; label: string; description: string }[] = [
  { value: "foundation", label: "Foundation", description: "Architecture and setup gates" },
  { value: "development", label: "Development", description: "Feature development checkpoints" },
  { value: "integration", label: "Integration", description: "System integration verification" },
  { value: "release", label: "Release", description: "Go-live readiness gates" },
];

interface CriterionDraft {
  title: string;
  description: string;
}

export function ProgramGateNewRoute() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  const workstreams = useQuery("workstreams:listByProgram" as any, { programId }) as
    | { _id: string; name: string }[]
    | undefined;
  const createGate = useMutation("sprintGates:create" as any);

  const [name, setName] = useState("");
  const [gateType, setGateType] = useState<GateType>("foundation");
  const [workstreamId, setWorkstreamId] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([{ title: "", description: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCriterion() {
    setCriteria((prev) => [...prev, { title: "", description: "" }]);
  }

  function removeCriterion(index: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCriterion(index: number, field: keyof CriterionDraft, value: string) {
    setCriteria((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !workstreamId || !orgId) return;

    const validCriteria = criteria.filter((c) => c.title.trim());
    if (validCriteria.length === 0) {
      setError("At least one criterion is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const gateId = await createGate({
        orgId,
        programId,
        workstreamId: workstreamId as any,
        name: name.trim(),
        gateType,
        criteria: validCriteria.map((c) => ({
          title: c.title.trim(),
          ...(c.description.trim() ? { description: c.description.trim() } : {}),
        })),
      });
      router.push(`/${slug}/gates/${gateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create gate");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto container">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-2 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-secondary"
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
          Back to Gates
        </button>
        <h1 className="type-display-m text-text-heading">Create Sprint Gate</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define a quality gate with criteria and approval requirements.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Gate name */}
        <div>
          <label className="form-label">
            Gate Name <span className="text-status-error-fg">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Foundation Review Gate"
            className="input w-full"
          />
        </div>

        {/* Two-column: type + workstream */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">
              Gate Type <span className="text-status-error-fg">*</span>
            </label>
            <select
              value={gateType}
              onChange={(e) => setGateType(e.target.value as GateType)}
              className="select w-full"
            >
              {GATE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">
              Workstream <span className="text-status-error-fg">*</span>
            </label>
            <select
              value={workstreamId}
              onChange={(e) => setWorkstreamId(e.target.value)}
              required
              className="select w-full"
            >
              <option value="">Select workstream...</option>
              {workstreams?.map((ws: any) => (
                <option key={ws._id} value={ws._id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Criteria builder */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="form-label mb-0">
              Criteria <span className="text-status-error-fg">*</span>
            </label>
            <button
              type="button"
              onClick={addCriterion}
              className="text-sm font-medium text-accent-default hover:text-accent-strong"
            >
              + Add Criterion
            </button>
          </div>
          <div className="space-y-3">
            {criteria.map((criterion, index) => (
              <div
                key={index}
                className="rounded-lg border border-border-default bg-surface-raised p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={criterion.title}
                      onChange={(e) => updateCriterion(index, "title", e.target.value)}
                      placeholder="Criterion title"
                      className="input w-full"
                    />
                    <input
                      value={criterion.description}
                      onChange={(e) => updateCriterion(index, "description", e.target.value)}
                      placeholder="Description (optional)"
                      className="input w-full text-xs"
                    />
                  </div>
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(index)}
                      className="mt-1 rounded p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-status-error-fg"
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
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border-default pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !workstreamId || isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Gate"}
          </button>
        </div>
      </form>
    </div>
  );
}
