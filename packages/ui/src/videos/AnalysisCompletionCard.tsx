"use client";

import Link from "next/link";
import { useProgramContext } from "../programs";

type VideoFinding = {
  _id: string;
  type: string;
  status: string;
  data?: unknown;
  sourceTimestamp: number;
  sourceTimestampEnd?: number;
  sourceExcerpt: string;
  confidence: string;
  segmentIndex?: number;
  synthesisNote?: string;
  suggestedWorkstream?: string;
};

interface AnalysisCompletionCardProps {
  programId: string;
  videoFindings: VideoFinding[] | undefined;
  analysis: {
    durationMs?: number;
    totalTokensUsed?: number;
    videoDurationMs?: number;
    stageTimestamps?: { completedAt?: number };
  };
}

const FINDING_TYPE_LABELS: Record<string, string> = {
  requirement: "Requirement",
  risk: "Risk",
  integration: "Integration",
  decision: "Decision",
  action_item: "Action Item",
};

const FINDING_TYPE_STYLES: Record<string, string> = {
  requirement: "bg-status-info-bg text-accent-default",
  risk: "bg-status-error-bg text-status-error-fg",
  integration: "bg-teal-100 text-teal-700",
  decision: "bg-status-warning-bg text-status-warning-fg",
  action_item: "bg-status-success-bg text-status-success-fg",
};

function formatClock(ms?: number): string {
  if (typeof ms !== "number") return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function getFindingTitle(finding: VideoFinding): string {
  const data = finding.data as Record<string, unknown> | null | undefined;
  if (data && typeof data === "object" && typeof data.title === "string" && data.title) {
    return data.title;
  }
  return FINDING_TYPE_LABELS[finding.type] ?? "Finding";
}

function getTypeBreakdown(findings: VideoFinding[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const f of findings) {
    counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function AnalysisCompletionCard({
  programId,
  videoFindings,
  analysis,
}: AnalysisCompletionCardProps) {
  const { slug } = useProgramContext();
  const isLoading = videoFindings === undefined;
  const findings = videoFindings ?? [];
  const hasFindings = findings.length > 0;
  const completedAt = analysis.stageTimestamps?.completedAt;

  const stats: { label: string; value: string; subtitle?: string }[] = [];

  if (!isLoading) {
    const breakdown = getTypeBreakdown(findings);
    const breakdownStr = breakdown
      .map((b) => `${b.count} ${FINDING_TYPE_LABELS[b.type] ?? b.type}`)
      .join(", ");
    stats.push({
      label: "Findings Extracted",
      value: String(findings.length),
      subtitle: breakdownStr || undefined,
    });
  }

  if (typeof analysis.videoDurationMs === "number") {
    stats.push({
      label: "Video Duration",
      value: formatClock(analysis.videoDurationMs),
    });
  }

  if (typeof analysis.durationMs === "number") {
    stats.push({
      label: "Processing Time",
      value: formatDuration(analysis.durationMs),
    });
  }

  if (typeof analysis.totalTokensUsed === "number") {
    stats.push({
      label: "Tokens Used",
      value: formatNumber(analysis.totalTokensUsed),
    });
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      {/* Success header */}
      <div className="flex items-center gap-3 rounded-t-xl border-b border-status-success-border bg-status-success-bg px-4 py-3 sm:px-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500">
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-status-success-fg">Analysis Complete</h3>
          {typeof completedAt === "number" && (
            <p className="text-xs text-status-success-fg">
              Completed{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(completedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {/* Stats row */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border-default p-5">
                <div className="h-3 w-16 rounded bg-surface-elevated" />
                <div className="mt-3 h-6 w-10 rounded bg-surface-elevated" />
              </div>
            ))}
          </div>
        ) : stats.length > 0 ? (
          <div
            className={`grid gap-4 sm:grid-cols-2 ${stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : ""}`}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border-default bg-surface-default p-5"
              >
                <p className="text-sm text-text-secondary">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-text-heading">{stat.value}</p>
                {stat.subtitle && <p className="mt-1 text-xs text-text-muted">{stat.subtitle}</p>}
              </div>
            ))}
          </div>
        ) : null}

        {/* Findings preview or empty state */}
        {!isLoading && hasFindings && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Top Findings
            </p>
            <div className="space-y-2">
              {findings.slice(0, 5).map((finding) => {
                const typeClasses =
                  FINDING_TYPE_STYLES[finding.type] ?? "bg-surface-raised text-text-primary";
                return (
                  <div
                    key={finding._id}
                    className="rounded-md border border-border-default px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${typeClasses}`}>
                        {FINDING_TYPE_LABELS[finding.type] ?? "Finding"}
                      </span>
                      <span className="font-medium text-text-heading">
                        {getFindingTitle(finding)}
                      </span>
                      {typeof finding.sourceTimestamp === "number" && (
                        <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-text-primary">
                          {formatClock(finding.sourceTimestamp)}
                        </span>
                      )}
                    </div>
                    {finding.sourceExcerpt && (
                      <p className="mt-1 line-clamp-2 text-text-primary">{finding.sourceExcerpt}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {findings.length > 5 && (
              <p className="mt-2 text-xs text-text-secondary">
                and {findings.length - 5} more finding{findings.length - 5 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {!isLoading && !hasFindings && (
          <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-5 text-center">
            <p className="text-sm font-medium text-text-primary">
              No findings were extracted from this recording.
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              This can happen when a video has no audio track, very brief content, or limited
              discussion.
            </p>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
          {!isLoading && hasFindings && (
            <Link
              href={`/${slug}/discovery`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
            >
              Review Findings
            </Link>
          )}
          <Link
            href={`/${slug}/videos`}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
          >
            Back to Visual Discovery
          </Link>
          <Link
            href={`/${slug}/videos/upload`}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
          >
            Upload Another Video
          </Link>
        </div>
      </div>
    </div>
  );
}
