"use client";

import { useOrganization } from "@clerk/nextjs";
import { useProgramContext } from "@foundry/ui/programs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StepEditor } from "./StepEditor";

type TargetPlatform = "salesforce_b2b" | "bigcommerce_b2b" | "platform_agnostic";

const PLATFORM_OPTIONS: { value: TargetPlatform; label: string }[] = [
  { value: "salesforce_b2b", label: "Salesforce B2B Commerce" },
  { value: "bigcommerce_b2b", label: "BigCommerce B2B" },
  { value: "platform_agnostic", label: "Platform Agnostic" },
];

interface PlaybookStep {
  title: string;
  description?: string;
  workstreamId?: string;
  estimatedHours?: number;
}

export default function NewPlaybookPage() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const createPlaybook = useMutation("playbooks:create" as any);

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>("platform_agnostic");
  const [steps, setSteps] = useState<PlaybookStep[]>([{ title: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!organization?.id) {
      setError("No organization selected");
      return;
    }

    // Validate at least one step with a title
    const validSteps = steps.filter((s) => s.title.trim());
    if (validSteps.length === 0) {
      setError("Add at least one step with a title");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createPlaybook({
        orgId: organization.id,
        programId,
        name: name.trim(),
        description: description.trim() || undefined,
        targetPlatform,
        steps: validSteps.map((s) => ({
          title: s.title.trim(),
          description: s.description?.trim() || undefined,
          workstreamId: s.workstreamId,
          estimatedHours: s.estimatedHours,
        })),
      });
      router.push(`/${slug}/playbooks`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create playbook");
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
        <h1 className="type-display-m text-text-heading">Create Playbook</h1>
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
              Playbook Name <span className="text-status-error-fg">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Standard B2B Commerce Migration"
              className="input w-full"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe this playbook's purpose and when to use it..."
              className="textarea w-full"
            />
          </div>

          {/* Target Platform */}
          <div className="mb-4">
            <label className="form-label">
              Target Platform <span className="text-status-error-fg">*</span>
            </label>
            <select
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
              className="select w-full"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Steps editor */}
        <div className="card p-6">
          <StepEditor steps={steps} onChange={setSteps} workstreams={(workstreams as any) ?? []} />
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
            disabled={!name.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Playbook"}
          </button>
        </div>
      </form>
    </div>
  );
}
