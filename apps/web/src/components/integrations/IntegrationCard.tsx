"use client";

type IntegrationType = "api" | "webhook" | "file_transfer" | "database" | "middleware" | "other";
type IntegrationStatus = "planned" | "in_progress" | "testing" | "live" | "deprecated";

const TYPE_BADGE: Record<IntegrationType, string> = {
  api: "bg-status-info-bg text-accent-default",
  webhook: "bg-status-success-bg text-status-success-fg",
  file_transfer: "bg-status-warning-bg text-status-warning-fg",
  database: "bg-status-warning-bg text-status-warning-fg",
  middleware: "bg-surface-raised text-text-primary",
  other: "bg-surface-elevated text-text-primary",
};

const TYPE_LABEL: Record<IntegrationType, string> = {
  api: "API",
  webhook: "Webhook",
  file_transfer: "File Transfer",
  database: "Database",
  middleware: "Middleware",
  other: "Other",
};

const STATUS_BADGE: Record<IntegrationStatus, string> = {
  planned: "bg-surface-elevated text-text-secondary",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  testing: "bg-status-info-bg text-accent-default",
  live: "bg-status-success-bg text-status-success-fg",
  deprecated: "bg-status-error-bg text-status-error-fg",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  testing: "Testing",
  live: "Live",
  deprecated: "Deprecated",
};

interface IntegrationCardProps {
  integration: {
    _id: string;
    name: string;
    type: string;
    sourceSystem: string;
    targetSystem: string;
    status: string;
    requirementIds?: string[];
  };
  onClick: () => void;
}

export function IntegrationCard({ integration, onClick }: IntegrationCardProps) {
  const intType = integration.type as IntegrationType;
  const intStatus = integration.status as IntegrationStatus;
  const reqCount = integration.requirementIds?.length ?? 0;

  return (
    <tr onClick={onClick} className="cursor-pointer transition-colors hover:bg-interactive-hover">
      <td className="max-w-xs truncate px-4 py-3 font-medium text-text-heading">
        {integration.name}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[intType]}`}
        >
          {TYPE_LABEL[intType]}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="max-w-[120px] truncate">{integration.sourceSystem}</span>
          <svg
            className="h-3 w-3 shrink-0 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="max-w-[120px] truncate">{integration.targetSystem}</span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[intStatus]}`}
        >
          {STATUS_LABEL[intStatus]}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{reqCount}</td>
    </tr>
  );
}
