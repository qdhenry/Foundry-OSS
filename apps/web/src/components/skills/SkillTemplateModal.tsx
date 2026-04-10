"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProgramContext } from "@/lib/programContext";
import { api } from "../../../convex/_generated/api";

interface SkillTemplateModalProps {
  programId: string;
  isOpen: boolean;
  onClose: () => void;
}

type Domain =
  | "architecture"
  | "backend"
  | "frontend"
  | "integration"
  | "deployment"
  | "testing"
  | "review"
  | "project";

const DOMAIN_BADGE: Record<Domain, string> = {
  architecture: "bg-status-success-bg text-status-success-fg",
  backend: "bg-status-info-bg text-status-info-fg",
  frontend: "bg-status-warning-bg text-status-warning-fg",
  integration: "bg-status-warning-bg text-status-warning-fg",
  deployment: "bg-status-success-bg text-status-success-fg",
  testing: "bg-status-error-bg text-status-error-fg",
  review: "bg-pink-100 text-pink-700",
  project: "bg-surface-elevated text-text-primary",
};

const DOMAIN_LABEL: Record<Domain, string> = {
  architecture: "Architecture",
  backend: "Backend",
  frontend: "Frontend",
  integration: "Integration",
  deployment: "Deployment",
  testing: "Testing",
  review: "Review",
  project: "Project",
};

export function SkillTemplateModal({ programId, isOpen, onClose }: SkillTemplateModalProps) {
  const router = useRouter();
  const { slug } = useProgramContext();
  const { organization } = useOrganization();
  const templates = useQuery(api.skills.listTemplates);
  const forkTemplate = useMutation(api.skills.forkTemplate);

  const [forking, setForking] = useState<number | null>(null);

  if (!isOpen) return null;

  async function handleFork(templateIndex: number) {
    if (!organization?.id) return;
    setForking(templateIndex);
    try {
      const skillId = await forkTemplate({
        orgId: organization.id,
        programId,
        templateIndex,
      });
      onClose();
      router.push(`/${slug}/skills/${skillId}`);
    } catch (err) {
      console.error("Failed to fork template:", err);
    } finally {
      setForking(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="max-h-[80vh] w-full container overflow-hidden rounded-xl border border-border-default bg-surface-default shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-text-heading">Skill Templates</h3>
              <p className="mt-0.5 text-sm text-text-secondary">
                Fork a template to create a new skill pre-populated with best practices
              </p>
            </div>
            <button
              onClick={onClose}
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

          {/* Template grid */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {templates === undefined ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-raised" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {templates.map((template: any, index: number) => (
                  <div
                    key={template.id}
                    className="flex flex-col rounded-lg border border-border-default p-4 transition-colors hover:border-accent-default"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOMAIN_BADGE[template.domain as Domain]}`}
                      >
                        {DOMAIN_LABEL[template.domain as Domain]}
                      </span>
                      <span className="text-xs text-text-muted">{template.lineCount} lines</span>
                    </div>
                    <h4 className="mb-1 text-sm font-semibold text-text-heading">
                      {template.name}
                    </h4>
                    <p className="mb-3 flex-1 text-xs text-text-secondary line-clamp-2">
                      {template.description}
                    </p>
                    <button
                      onClick={() => handleFork(index)}
                      disabled={forking !== null}
                      className="w-full rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
                    >
                      {forking === index ? "Forking..." : "Fork to Program"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
