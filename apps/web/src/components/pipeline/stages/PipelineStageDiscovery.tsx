"use client";

import { useProgramContext } from "@/lib/programContext";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StageNextSteps } from "./StageNextSteps";

interface PipelineStageDiscoveryProps {
  requirement: {
    _id: string;
    refId: string;
    title: string;
    description?: string;
  };
  programId: Id<"programs">;
  workstreamId: Id<"workstreams">;
  tasks: Array<{ _id: string; title: string; status: string }>;
  finding?: {
    _id: string;
    status: string;
    type: string;
    confidence?: string;
    sourceExcerpt?: string;
    documentName?: string;
    data?: unknown;
  } | null;
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-error-bg text-status-error-fg",
};

export function PipelineStageDiscovery({
  requirement,
  programId,
  finding,
}: PipelineStageDiscoveryProps) {
  const { slug } = useProgramContext();
  if (!finding) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <h3 className="mb-2 text-sm font-semibold text-text-heading">Discovery</h3>
          <p className="text-sm text-text-secondary">
            This requirement was created manually and did not originate from a discovery finding.
          </p>
        </div>
        <StageNextSteps
          steps={[
            {
              label: "Review the finding in Discovery Hub",
              description:
                "Upload documents and analyze them to link findings to this requirement.",
              href: `/${slug}/discovery?tab=findings`,
            },
          ]}
        />
      </div>
    );
  }

  const data = (finding.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-heading">Discovery Finding</h3>
          <div className="flex items-center gap-2">
            {finding.confidence && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_BADGE[finding.confidence] ?? "bg-surface-elevated text-text-primary"}`}
              >
                {finding.confidence} confidence
              </span>
            )}
            <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-xs font-medium text-accent-default">
              {finding.status}
            </span>
          </div>
        </div>

        {finding.sourceExcerpt && (
          <div className="mb-3 rounded-lg border border-border-default bg-surface-raised p-3">
            <p className="text-xs font-medium text-text-secondary">Source Excerpt</p>
            <p className="mt-1 text-sm italic text-text-primary">
              &ldquo;{finding.sourceExcerpt}&rdquo;
            </p>
          </div>
        )}

        {finding.documentName && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
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
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            Source: {finding.documentName}
          </div>
        )}
      </div>

      {/* Finding data details */}
      {typeof data.description === "string" && (
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <h4 className="mb-2 text-xs font-medium text-text-secondary">Extracted Description</h4>
          <p className="text-sm text-text-primary">{data.description as string}</p>
        </div>
      )}

      <StageNextSteps
        steps={[
          {
            label: "Review the finding in Discovery Hub",
            description:
              "Verify the AI-extracted data is accurate and approve or edit before advancing.",
            href: `/${slug}/discovery?tab=findings`,
          },
        ]}
      />
    </div>
  );
}
