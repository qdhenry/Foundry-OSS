"use client";

import { useOrganization } from "@clerk/nextjs";
import { useProgramContext } from "@foundry/ui/programs";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Domain =
  | "architecture"
  | "backend"
  | "frontend"
  | "integration"
  | "deployment"
  | "testing"
  | "review"
  | "project";
type TargetPlatform = "salesforce_b2b" | "bigcommerce_b2b" | "platform_agnostic";

const DOMAIN_OPTIONS: { value: Domain; label: string }[] = [
  { value: "architecture", label: "Architecture" },
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "integration", label: "Integration" },
  { value: "deployment", label: "Deployment" },
  { value: "testing", label: "Testing" },
  { value: "review", label: "Review" },
  { value: "project", label: "Project" },
];

const PLATFORM_OPTIONS: { value: TargetPlatform; label: string }[] = [
  { value: "salesforce_b2b", label: "Salesforce B2B Commerce" },
  { value: "bigcommerce_b2b", label: "BigCommerce B2B" },
  { value: "platform_agnostic", label: "Platform Agnostic" },
];

export default function NewSkillPage() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const createSkill = useMutation("skills:create" as any);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState<Domain>("architecture");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>("salesforce_b2b");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    if (!organization?.id) {
      setError("No organization selected");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const skillId = await createSkill({
        orgId: organization.id,
        programId,
        name: name.trim(),
        domain,
        targetPlatform,
        content,
      });
      router.push(`/${slug}/skills/${skillId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create skill");
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
        <h1 className="type-display-m text-text-heading">Create Skill</h1>
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
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Skill Name <span className="text-status-error-fg">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Apex Development Standards"
              className="input w-full"
            />
          </div>

          {/* Domain + Platform */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Domain <span className="text-status-error-fg">*</span>
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as Domain)}
                className="select w-full"
              >
                {DOMAIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
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

          {/* Content */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Content <span className="text-status-error-fg">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={16}
              placeholder="# Skill Title&#10;&#10;## Overview&#10;&#10;Describe the skill's purpose and scope...&#10;&#10;## Key Responsibilities&#10;&#10;- Responsibility 1&#10;- Responsibility 2"
              className="textarea w-full font-mono"
            />
            <p className="mt-1 text-xs text-text-muted">{content.split("\n").length} lines</p>
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
            disabled={!name.trim() || !content.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Skill"}
          </button>
        </div>
      </form>
    </div>
  );
}
