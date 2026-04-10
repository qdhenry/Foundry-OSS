"use client";

import Link from "next/link";

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  pending: {
    className: "bg-surface-raised text-text-secondary",
    label: "Pending",
  },
  scanning: {
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse",
    label: "Scanning",
  },
  analyzing: {
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse",
    label: "Analyzing",
  },
  mapping: {
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse",
    label: "Mapping",
  },
  touring: {
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse",
    label: "Touring",
  },
  reviewing: {
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse",
    label: "Reviewing",
  },
  completed: {
    className: "bg-status-success-bg text-status-success-fg",
    label: "Completed",
  },
  failed: {
    className: "bg-status-error-bg text-status-error-fg",
    label: "Failed",
  },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.pending;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function extractRepoName(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : url;
  } catch {
    return url;
  }
}

export interface AnalysisListProps {
  analyses: any[];
  slug: string;
}

export function AnalysisList({ analyses, slug }: AnalysisListProps) {
  return (
    <div className="space-y-2">
      {analyses.map((analysis: any) => {
        const status = getStatusStyle(analysis.status);
        const repoName = analysis.repoUrl
          ? extractRepoName(analysis.repoUrl)
          : "Unknown repository";

        return (
          <Link
            key={analysis._id}
            href={`/${slug}/utilities/code-analyzer/${analysis._id}`}
            className="flex items-center justify-between rounded-xl border border-border-default bg-surface-secondary p-4 transition-all duration-200 hover:border-border-accent hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-heading">{repoName}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {analysis._creationTime ? formatDate(analysis._creationTime) : "Unknown date"}
              </p>
            </div>
            <span
              className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
