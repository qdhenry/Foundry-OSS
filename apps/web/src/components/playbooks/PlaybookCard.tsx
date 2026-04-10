"use client";

import { useRouter } from "next/navigation";
import { useProgramContext } from "@/lib/programContext";

type TargetPlatform =
  | "salesforce_b2b"
  | "bigcommerce_b2b"
  | "sitecore"
  | "wordpress"
  | "none"
  | "platform_agnostic";
type Status = "draft" | "published" | "archived";

const STATUS_BADGE: Record<Status, string> = {
  draft: "bg-surface-elevated text-text-secondary",
  published: "bg-status-success-bg text-status-success-fg",
  archived: "bg-status-warning-bg text-status-warning-fg",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const PLATFORM_BADGE: Record<TargetPlatform, string> = {
  salesforce_b2b: "bg-status-info-bg text-accent-default",
  bigcommerce_b2b: "bg-status-success-bg text-status-success-fg",
  sitecore: "bg-status-error-bg text-status-error-fg",
  wordpress: "bg-status-info-bg text-status-info-fg",
  none: "bg-surface-elevated text-text-secondary",
  platform_agnostic: "bg-surface-elevated text-text-secondary",
};

const PLATFORM_LABEL: Record<TargetPlatform, string> = {
  salesforce_b2b: "Salesforce B2B",
  bigcommerce_b2b: "BigCommerce B2B",
  sitecore: "Sitecore",
  wordpress: "WordPress",
  none: "None",
  platform_agnostic: "Platform Agnostic",
};

interface PlaybookCardProps {
  playbook: {
    _id: string;
    name: string;
    description?: string;
    targetPlatform: TargetPlatform;
    steps: { title: string }[];
    status: Status;
  };
  programId: string;
}

export function PlaybookCard({ playbook, programId }: PlaybookCardProps) {
  const { slug } = useProgramContext();
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/${slug}/playbooks/${playbook._id}`)}
      className="cursor-pointer rounded-xl border border-border-default bg-surface-default p-4 transition-all hover:border-accent-default hover:shadow-md"
    >
      {/* Title + status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-heading line-clamp-2">{playbook.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[playbook.status]}`}
        >
          {STATUS_LABEL[playbook.status]}
        </span>
      </div>

      {/* Description preview */}
      {playbook.description && (
        <p className="mb-3 text-xs text-text-secondary line-clamp-2">{playbook.description}</p>
      )}

      {/* Platform badge + step count */}
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_BADGE[playbook.targetPlatform]}`}
        >
          {PLATFORM_LABEL[playbook.targetPlatform]}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          {playbook.steps.length} step{playbook.steps.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
