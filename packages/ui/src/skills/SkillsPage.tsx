"use client";

import { useProgramContext } from "@foundry/ui/programs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useStaggerEntrance } from "../theme/useAnimations";
import { SkillTemplateModal } from "./SkillTemplateModal";

type Domain =
  | "architecture"
  | "backend"
  | "frontend"
  | "integration"
  | "deployment"
  | "testing"
  | "review"
  | "project";
type Status = "draft" | "active" | "deprecated";

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

const DOMAIN_BADGE: Record<Domain, string> = {
  architecture: "bg-status-success-bg text-status-success-fg",
  backend: "bg-status-info-bg text-status-info-fg",
  frontend: "bg-status-warning-bg text-status-warning-fg",
  integration: "bg-status-warning-bg text-status-warning-fg",
  deployment: "bg-status-success-bg text-status-success-fg",
  testing: "bg-status-error-bg text-status-error-fg",
  review: "bg-status-error-bg text-status-error-fg",
  project: "bg-surface-raised text-text-secondary",
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

const STATUS_BADGE: Record<Status, string> = {
  draft: "bg-surface-raised text-text-secondary",
  active: "bg-status-success-bg text-status-success-fg",
  deprecated: "bg-status-error-bg text-status-error-fg",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  active: "Active",
  deprecated: "Deprecated",
};

const PLATFORM_LABEL: Record<string, string> = {
  salesforce_b2b: "Salesforce B2B",
  bigcommerce_b2b: "BigCommerce B2B",
  platform_agnostic: "Agnostic",
};

export default function SkillsPage() {
  const { programId, slug } = useProgramContext();
  const router = useRouter();

  const [domainFilter, setDomainFilter] = useState<Domain | "">("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(tableRef, ".animate-card");

  const skills = useQuery(
    "skills:listByProgram" as any,
    programId
      ? {
          programId,
          ...(domainFilter ? { domain: domainFilter } : {}),
        }
      : "skip",
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Skills</h1>
          {skills && (
            <p className="mt-1 text-sm text-text-secondary">
              {skills.length} skill{skills.length !== 1 ? "s" : ""} configured
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="btn-secondary inline-flex items-center gap-2"
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Browse Templates
          </button>
          <button
            onClick={() => router.push(`/${slug}/skills/new`)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Skill
          </button>
        </div>
      </div>

      {/* Domain filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDomainFilter("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            domainFilter === ""
              ? "bg-interactive-subtle text-accent-default"
              : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
          }`}
        >
          All
        </button>
        {DOMAIN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDomainFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              domainFilter === opt.value
                ? "bg-interactive-subtle text-accent-default"
                : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Skills table */}
      {skills === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading skills...</p>
        </div>
      ) : skills.length === 0 ? (
        <div className="card border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-interactive-subtle">
            <svg
              className="h-8 w-8 text-accent-default"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">No skills yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Skills are AI agent instruction sets that power automated delivery. Create a new skill
            or browse templates to get started.
          </p>
          <button
            onClick={() => router.push(`/${slug}/skills/new`)}
            className="btn-primary btn-sm mt-4 inline-flex items-center gap-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add your first skill
          </button>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-lg border border-border-default">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-default bg-surface-raised">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Domain</th>
                <th className="table-header">Platform</th>
                <th className="table-header">Version</th>
                <th className="table-header">Status</th>
                <th className="table-header">Lines</th>
                <th className="table-header">Linked Reqs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface-default">
              {skills.map((skill: any) => (
                <tr
                  key={skill._id}
                  onClick={() => router.push(`/${slug}/skills/${skill._id}`)}
                  className="animate-card table-row-hover cursor-pointer"
                >
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-text-primary">
                    {skill.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DOMAIN_BADGE[skill.domain as Domain]}`}
                    >
                      {DOMAIN_LABEL[skill.domain as Domain]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {PLATFORM_LABEL[skill.targetPlatform] ?? skill.targetPlatform}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                      {skill.currentVersion}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[skill.status as Status]}`}
                    >
                      {STATUS_LABEL[skill.status as Status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-secondary">
                    {skill.lineCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {skill.linkedRequirements?.length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Template modal */}
      <SkillTemplateModal
        programId={programId}
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />
    </div>
  );
}
