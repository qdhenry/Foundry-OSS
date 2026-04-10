"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface CodeHealthSectionProps {
  programId: Id<"programs">;
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "green" | "amber" | "red" | "default";
}) {
  const valueColor =
    color === "green"
      ? "text-status-success-fg"
      : color === "amber"
        ? "text-status-warning-fg"
        : color === "red"
          ? "text-status-error-fg"
          : "text-text-heading";

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function CommitVelocityBar({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="mt-4 rounded-lg border border-border-default bg-surface-raised p-3">
      <p className="mb-2 text-xs font-medium text-text-secondary">Commit Velocity (last 7 days)</p>
      <div className="flex items-end gap-1.5" style={{ height: "48px" }}>
        {data.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center" style={{ height: "36px" }}>
              <div
                className="w-full max-w-[20px] rounded-sm bg-accent-default transition-all"
                style={{
                  height: `${Math.max((count / max) * 36, count > 0 ? 4 : 0)}px`,
                }}
              />
            </div>
            <span className="text-[10px] text-text-muted">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getScoreColor(score: number): "green" | "amber" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function CodeHealthSection({ programId }: CodeHealthSectionProps) {
  const healthData = useQuery(api.sourceControl.health.codeHealthSignals.getForProgram, {
    programId,
  });

  // Loading state
  if (healthData === undefined) {
    return (
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <TerminalIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Code Health</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-border-default bg-surface-raised"
            />
          ))}
        </div>
      </section>
    );
  }

  // Empty state — no repos connected
  if (!healthData || healthData.repoCount === 0) {
    return (
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <TerminalIcon className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-heading">Code Health</h2>
        </div>
        <div className="rounded-xl border border-dashed border-border-default bg-surface-raised p-6 text-center">
          <TerminalIcon className="mx-auto mb-2 h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-secondary">
            Connect repositories in Settings to see code health metrics
          </p>
        </div>
      </section>
    );
  }

  const ciColor = getScoreColor(healthData.ciPassRate);
  const prsAwaitingColor =
    healthData.prsAwaitingReview > 3
      ? "amber"
      : healthData.prsAwaitingReview > 0
        ? "default"
        : "green";

  // Generate placeholder velocity data from commit count
  // In a real scenario this would come from a dedicated daily-breakdown query
  const totalCommits = healthData.commitCount7d;
  const velocityData = generateVelocityPlaceholder(totalCommits);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <TerminalIcon className="h-5 w-5 text-text-muted" />
        <h2 className="text-lg font-semibold text-text-heading">Code Health</h2>
        {/* Composite score badge */}
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getScoreColor(healthData.compositeScore) === "green"
              ? "bg-status-success-bg text-status-success-fg"
              : getScoreColor(healthData.compositeScore) === "amber"
                ? "bg-status-warning-bg text-status-warning-fg"
                : "bg-status-error-bg text-status-error-fg"
          }`}
        >
          Score: {healthData.compositeScore}/100
        </span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Commits this week" value={healthData.commitCount7d} color="default" />
        <KpiCard label="PRs merged" value={healthData.prsMerged7d} color="green" />
        <KpiCard
          label="PRs awaiting review"
          value={healthData.prsAwaitingReview}
          color={prsAwaitingColor as any}
        />
        <KpiCard label="CI pass rate" value={`${healthData.ciPassRate}%`} color={ciColor} />
      </div>

      {/* Commit velocity bar chart */}
      <CommitVelocityBar data={velocityData} />

      {/* Single-author concentration warning */}
      {healthData.singleAuthorWarning && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-status-warning-fg" />
          <p className="text-xs text-status-warning-fg">
            Single-author concentration detected — one contributor authored more than 70% of recent
            commits
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Generate a plausible 7-day commit distribution from a weekly total.
 * Weighted towards weekdays. Used until a dedicated daily-breakdown query exists.
 */
function generateVelocityPlaceholder(total: number): number[] {
  if (total === 0) return [0, 0, 0, 0, 0, 0, 0];
  // Weekday-heavy distribution weights
  const weights = [0.18, 0.2, 0.2, 0.18, 0.14, 0.05, 0.05];
  const raw = weights.map((w) => Math.round(total * w));
  // Adjust rounding to match total
  const diff = total - raw.reduce((a, b) => a + b, 0);
  if (diff !== 0) raw[2] += diff;
  return raw;
}
