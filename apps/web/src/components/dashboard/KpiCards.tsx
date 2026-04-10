"use client";

import { Activity, AlertTriangle, BarChart01, LayersThree01 } from "@untitledui/icons";

interface ProgramStats {
  totalRequirements: number;
  completedRequirements: number;
  completionPercent: number;
  workstreamCount: number;
  riskCount: number;
  agentExecutionCount: number;
}

interface WorkstreamHealth {
  onTrack: number;
  atRisk: number;
  blocked: number;
}

interface KpiCardsProps {
  stats: ProgramStats;
  workstreamHealth: WorkstreamHealth;
}

export function KpiCards({ stats, workstreamHealth }: KpiCardsProps) {
  const cards = [
    {
      icon: BarChart01,
      label: "Requirement Completion",
      value: `${stats.completionPercent}%`,
      subtitle: `${stats.completedRequirements}/${stats.totalRequirements} completed`,
    },
    {
      icon: LayersThree01,
      label: "Workstream Health",
      value: stats.workstreamCount,
      subtitle: (
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-status-success-fg" />
            {workstreamHealth.onTrack}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-status-warning-fg" />
            {workstreamHealth.atRisk}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-status-error-fg" />
            {workstreamHealth.blocked}
          </span>
        </span>
      ),
    },
    {
      icon: AlertTriangle,
      label: "Active Risks",
      value: stats.riskCount,
      subtitle: `${stats.riskCount === 0 ? "No" : stats.riskCount} open risk${stats.riskCount !== 1 ? "s" : ""}`,
    },
    {
      icon: Activity,
      label: "Agent Executions",
      value: stats.agentExecutionCount,
      subtitle: "Total executions",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-border-default bg-surface-default p-5"
          >
            <Icon size={20} className="text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-text-heading">{card.value}</p>
            <div className="mt-1 text-xs text-text-muted">{card.subtitle}</div>
          </div>
        );
      })}
    </div>
  );
}
