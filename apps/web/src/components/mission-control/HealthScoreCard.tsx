"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface HealthScoreCardProps {
  workstreamId: Id<"workstreams">;
  workstreamName: string;
}

const healthColors: Record<
  string,
  { bg: string; border: string; badge: string; text: string; bar: string }
> = {
  on_track: {
    bg: "bg-status-success-bg",
    border: "border-status-success-border",
    badge: "bg-status-success-bg text-status-success-fg",
    text: "On Track",
    bar: "bg-status-success-fg",
  },
  at_risk: {
    bg: "bg-status-warning-bg",
    border: "border-status-warning-border",
    badge: "bg-status-warning-bg text-status-warning-fg",
    text: "At Risk",
    bar: "bg-status-warning-fg",
  },
  blocked: {
    bg: "bg-status-error-bg",
    border: "border-status-error-border",
    badge: "bg-status-error-bg text-status-error-fg",
    text: "Blocked",
    bar: "bg-status-error-fg",
  },
};

const factorLabels: Record<string, string> = {
  velocityScore: "Velocity",
  taskAgingScore: "Task Health",
  riskScore: "Risk Level",
  gatePassRate: "Gate Pass Rate",
  dependencyScore: "Dependencies",
};

function FactorBar({ label, score, barColor }: { label: string; score: number; barColor: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={`${barColor} h-1.5 rounded-full transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

export function HealthScoreCard({ workstreamId, workstreamName }: HealthScoreCardProps) {
  const latestScore = useQuery(api.healthScoring.getLatestHealthScore, {
    workstreamId,
  });

  if (latestScore === undefined) {
    return (
      <div className="animate-pulse rounded-xl border border-border-default bg-surface-default p-4">
        <div className="mb-3 h-4 w-1/2 rounded bg-surface-raised" />
        <div className="mb-2 h-3 w-3/4 rounded bg-surface-raised" />
        <div className="h-3 w-1/2 rounded bg-surface-raised" />
      </div>
    );
  }

  if (!latestScore) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h3 className="mb-1 font-medium text-text-heading">{workstreamName}</h3>
        <p className="text-sm text-text-secondary">No health data available yet</p>
      </div>
    );
  }

  const colors = healthColors[latestScore.health] ?? healthColors.on_track;
  const factorEntries = Object.entries(latestScore.factors as Record<string, number>);

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-text-heading">{workstreamName}</h3>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
            {colors.text}
          </span>
          <span className="text-sm font-bold text-text-primary">{latestScore.healthScore}/100</span>
        </div>
      </div>

      <p className="mb-4 text-sm text-text-secondary">{latestScore.reasoning}</p>

      <div className="space-y-2">
        {factorEntries.map(([key, value]) => (
          <FactorBar
            key={key}
            label={factorLabels[key] ?? key}
            score={value}
            barColor={colors.bar}
          />
        ))}
      </div>

      {latestScore.changeReason && (
        <div className="mt-3 rounded-md bg-surface-default/60 px-2.5 py-1.5 text-xs text-text-secondary">
          <span className="font-medium">Change: </span>
          {latestScore.changeReason}
        </div>
      )}
    </div>
  );
}
