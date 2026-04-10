"use client";

import type { DiscoveryTab } from "./DiscoveryTabBar";

interface DiscoveryStatsProps {
  documentCount: number;
  pendingFindingsCount: number;
  requirementsCount: number;
  analyzingCount: number;
  loading?: boolean;
  onStatClick?: (target: DiscoveryTab) => void;
}

export function DiscoveryStats({
  documentCount,
  pendingFindingsCount,
  requirementsCount,
  analyzingCount,
  loading,
  onStatClick,
}: DiscoveryStatsProps) {
  const cards: {
    label: string;
    value: number;
    tone: string;
    bg: string;
    target: DiscoveryTab;
    tooltip: string;
  }[] = [
    {
      label: "Documents",
      value: documentCount,
      tone: "text-text-primary",
      bg: "bg-surface-raised",
      target: "documents",
      tooltip: "Total documents uploaded for analysis",
    },
    {
      label: "Pending Findings",
      value: pendingFindingsCount,
      tone: pendingFindingsCount > 0 ? "text-status-warning-fg" : "text-text-primary",
      bg: pendingFindingsCount > 0 ? "bg-status-warning-bg" : "bg-surface-raised",
      target: "findings",
      tooltip: "Findings extracted by AI but not yet reviewed",
    },
    {
      label: "Imported",
      value: requirementsCount,
      tone: "text-text-primary",
      bg: "bg-surface-raised",
      target: "imported",
      tooltip: "Findings imported as requirements, risks, or integrations",
    },
    {
      label: "Analyzing",
      value: analyzingCount,
      tone: analyzingCount > 0 ? "text-status-info-fg" : "text-text-primary",
      bg: analyzingCount > 0 ? "bg-status-info-bg" : "bg-surface-raised",
      target: "documents",
      tooltip: "Documents currently being analyzed by AI",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            data-skeleton
            className="animate-pulse rounded-xl border border-border-default bg-surface-raised p-4"
          >
            <div className="h-3 w-20 rounded bg-surface-elevated" />
            <div className="mt-3 h-7 w-12 rounded bg-surface-elevated" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          title={card.tooltip}
          onClick={() => onStatClick?.(card.target)}
          className={`cursor-pointer rounded-xl border border-border-default p-4 text-left transition-shadow hover:shadow-md ${card.bg}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {card.label}
          </p>
          <p className={`mt-2 text-2xl font-semibold ${card.tone}`}>{card.value}</p>
        </button>
      ))}
    </div>
  );
}
