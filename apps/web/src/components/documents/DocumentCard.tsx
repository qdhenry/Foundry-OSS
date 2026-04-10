"use client";

const CATEGORY_BADGE: Record<string, string> = {
  architecture: "bg-status-success-bg text-status-success-fg",
  requirements: "bg-status-info-bg text-accent-default",
  testing: "bg-status-warning-bg text-status-warning-fg",
  deployment: "bg-status-success-bg text-status-success-fg",
  meeting_notes: "bg-status-warning-bg text-status-warning-fg",
  other: "bg-surface-elevated text-text-secondary",
};

const CATEGORY_LABEL: Record<string, string> = {
  architecture: "Architecture",
  requirements: "Requirements",
  testing: "Testing",
  deployment: "Deployment",
  meeting_notes: "Meeting Notes",
  other: "Other",
};

type AnalysisStatus = "none" | "queued" | "analyzing" | "complete" | "completed" | "failed";

const ANALYSIS_BADGE: Record<AnalysisStatus, { label: string; classes: string }> = {
  none: {
    label: "\u2014",
    classes: "",
  },
  queued: {
    label: "Queued",
    classes: "bg-surface-elevated text-text-secondary",
  },
  analyzing: {
    label: "Analyzing\u2026",
    classes: "bg-status-warning-bg text-status-warning-fg animate-pulse",
  },
  complete: {
    label: "Analyzed",
    classes:
      "bg-status-success-bg text-status-success-fg cursor-pointer hover:bg-status-success-bg/80",
  },
  completed: {
    label: "Analyzed",
    classes:
      "bg-status-success-bg text-status-success-fg cursor-pointer hover:bg-status-success-bg/80",
  },
  failed: {
    label: "Failed",
    classes: "bg-status-error-bg text-status-error-fg",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DocumentCardProps {
  document: {
    _id: string;
    _creationTime: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    category: string;
    description?: string;
    uploaderName: string;
    downloadUrl: string | null;
    analysisStatus?: AnalysisStatus;
  };
  onDelete: (id: string) => void;
  onViewAnalysis?: (id: string) => void;
}

export function DocumentCard({ document, onDelete, onViewAnalysis }: DocumentCardProps) {
  const analysisStatus = (document.analysisStatus ?? "none") as AnalysisStatus;
  const analysisBadge = ANALYSIS_BADGE[analysisStatus] ?? ANALYSIS_BADGE.none;
  const isAnalysisComplete = analysisStatus === "complete" || analysisStatus === "completed";

  return (
    <tr className="border-b border-border-default transition-colors hover:bg-interactive-hover">
      {/* File name + icon */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
            <svg
              className="h-4 w-4 text-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-heading">{document.fileName}</p>
            {document.description && (
              <p className="truncate text-xs text-text-secondary">{document.description}</p>
            )}
          </div>
        </div>
      </td>

      {/* Category badge */}
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[document.category] ?? CATEGORY_BADGE.other}`}
        >
          {CATEGORY_LABEL[document.category] ?? document.category}
        </span>
      </td>

      {/* File type */}
      <td className="px-4 py-3">
        <span className="text-xs uppercase text-text-secondary">
          {document.fileType.split("/").pop() ?? document.fileType}
        </span>
      </td>

      {/* File size */}
      <td className="px-4 py-3">
        <span className="text-sm text-text-primary">{formatFileSize(document.fileSize)}</span>
      </td>

      {/* Uploaded by */}
      <td className="px-4 py-3">
        <span className="text-sm text-text-primary">{document.uploaderName}</span>
      </td>

      {/* Date */}
      <td className="px-4 py-3">
        <span className="text-xs text-text-secondary">{formatDate(document._creationTime)}</span>
      </td>

      {/* Analysis status */}
      <td className="px-4 py-3">
        {analysisStatus === "none" ? (
          <span className="text-sm text-text-muted">{"\u2014"}</span>
        ) : isAnalysisComplete ? (
          <button
            onClick={() => onViewAnalysis?.(document._id)}
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${analysisBadge.classes}`}
          >
            {analysisBadge.label}
          </button>
        ) : (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${analysisBadge.classes}`}
          >
            {analysisBadge.label}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {document.downloadUrl && (
            <a
              href={document.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-accent-default"
              title="Download"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </a>
          )}
          <button
            onClick={() => onDelete(document._id)}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
            title="Delete"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
