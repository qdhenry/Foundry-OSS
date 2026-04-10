"use client";

import { Activity, AlertTriangle, BarChart01, LayersThree01 } from "@untitledui/icons";
import type { FC, SVGProps } from "react";
import { useRef } from "react";
import { useCountUp } from "../theme/useAnimations";

function CountUpValue({ value, format }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, value, format ? { format } : undefined);
  return <span ref={ref}>{format ? format(value) : String(value)}</span>;
}

export interface ProgramStats {
  totalRequirements: number;
  completedRequirements: number;
  completionPercent: number;
  workstreamCount: number;
  riskCount: number;
  agentExecutionCount: number;
}

export interface WorkstreamHealth {
  onTrack: number;
  atRisk: number;
  blocked: number;
}

interface KpiCardDef {
  icon: FC<SVGProps<SVGSVGElement> & { size?: number }>;
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  subtitle: string | React.ReactNode;
  priority: number;
}

interface KpiCardsProps {
  stats: ProgramStats;
  workstreamHealth: WorkstreamHealth;
}

export function KpiCards({ stats, workstreamHealth }: KpiCardsProps) {
  const hasProblems = workstreamHealth.atRisk > 0 || workstreamHealth.blocked > 0;

  const allCards: KpiCardDef[] = [
    // Always show requirement completion
    {
      icon: BarChart01,
      label: "Requirement Completion",
      value: stats.completionPercent,
      formatValue: (n: number) => `${Math.round(n)}%`,
      subtitle: `${stats.completedRequirements}/${stats.totalRequirements} completed`,
      priority: 0,
    },
    // Show risks when there are open risks
    {
      icon: AlertTriangle,
      label: "Active Risks",
      value: stats.riskCount,
      subtitle: `${stats.riskCount === 0 ? "No" : stats.riskCount} open risk${stats.riskCount !== 1 ? "s" : ""}`,
      priority: stats.riskCount > 0 ? 1 : 10,
    },
    // Workstream health — prioritize when problems exist
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
      priority: hasProblems ? 2 : 5,
    },
    // Agent executions — show when agents have run
    {
      icon: Activity,
      label: "Agent Executions",
      value: stats.agentExecutionCount,
      subtitle: "Total executions",
      priority: stats.agentExecutionCount > 0 ? 3 : 8,
    },
  ];

  const cards = allCards.sort((a, b) => a.priority - b.priority).slice(0, 4);

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
            <p className="mt-1 text-2xl font-bold text-text-heading">
              <CountUpValue value={card.value} format={card.formatValue} />
            </p>
            <div className="mt-1 text-xs text-text-muted">{card.subtitle}</div>
          </div>
        );
      })}
    </div>
  );
}
