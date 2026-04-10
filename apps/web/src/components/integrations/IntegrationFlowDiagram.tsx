"use client";

type IntegrationType = "api" | "webhook" | "file_transfer" | "database" | "middleware" | "other";

const TYPE_COLOR: Record<IntegrationType, { bg: string; border: string; text: string }> = {
  api: {
    bg: "bg-status-info-bg",
    border: "border-status-info-border",
    text: "text-accent-default",
  },
  webhook: {
    bg: "bg-status-success-bg",
    border: "border-status-success-border",
    text: "text-status-success-fg",
  },
  file_transfer: {
    bg: "bg-status-warning-bg",
    border: "border-status-warning-border",
    text: "text-status-warning-fg",
  },
  database: {
    bg: "bg-status-warning-bg",
    border: "border-status-warning-border",
    text: "text-status-warning-fg",
  },
  middleware: {
    bg: "bg-surface-raised",
    border: "border-border-default",
    text: "text-text-primary",
  },
  other: {
    bg: "bg-surface-raised",
    border: "border-border-default",
    text: "text-text-primary",
  },
};

const TYPE_LABEL: Record<IntegrationType, string> = {
  api: "API",
  webhook: "Webhook",
  file_transfer: "File Transfer",
  database: "Database",
  middleware: "Middleware",
  other: "Other",
};

interface IntegrationFlowDiagramProps {
  sourceSystem: string;
  targetSystem: string;
  type: string;
}

export function IntegrationFlowDiagram({
  sourceSystem,
  targetSystem,
  type,
}: IntegrationFlowDiagramProps) {
  const intType = type as IntegrationType;
  const colors = TYPE_COLOR[intType] ?? TYPE_COLOR.other;

  return (
    <div className="flex items-center justify-center gap-0 py-4">
      {/* Source system box */}
      <div className="flex min-w-[120px] max-w-[180px] flex-col items-center rounded-lg border border-border-default bg-surface-default px-4 py-3 shadow-sm">
        <svg
          className="mb-1.5 h-5 w-5 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
          />
        </svg>
        <span className="text-center text-xs font-medium text-text-secondary">Source</span>
        <span className="mt-0.5 text-center text-sm font-semibold text-text-heading">
          {sourceSystem}
        </span>
      </div>

      {/* Arrow + type label */}
      <div className="flex flex-col items-center px-2">
        <div className="flex items-center">
          <div className="h-px w-6 bg-border-default" />
          <div className={`rounded-lg border px-3 py-1.5 ${colors.bg} ${colors.border}`}>
            <span className={`text-xs font-semibold ${colors.text}`}>
              {TYPE_LABEL[intType] ?? type}
            </span>
          </div>
          <div className="h-px w-4 bg-border-default" />
          <svg className="h-3 w-3 -ml-0.5 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 5l7 7-7 7V5z" />
          </svg>
        </div>
      </div>

      {/* Target system box */}
      <div className="flex min-w-[120px] max-w-[180px] flex-col items-center rounded-lg border border-border-default bg-surface-default px-4 py-3 shadow-sm">
        <svg
          className="mb-1.5 h-5 w-5 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
          />
        </svg>
        <span className="text-center text-xs font-medium text-text-secondary">Target</span>
        <span className="mt-0.5 text-center text-sm font-semibold text-text-heading">
          {targetSystem}
        </span>
      </div>
    </div>
  );
}
