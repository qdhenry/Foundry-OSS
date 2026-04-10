"use client";

import type { DiscoveryTab } from "./DiscoveryTabBar";

interface DiscoveryStatsProps {
  documentCount: number;
  pendingFindingsCount: number;
  requirementsCount: number;
  analyzingCount: number;
  onStatClick?: (target: DiscoveryTab) => void;
}

export function DiscoveryStats({
  documentCount,
  pendingFindingsCount,
  requirementsCount,
  analyzingCount,
  onStatClick,
}: DiscoveryStatsProps) {
  const cards: {
    label: string;
    value: number;
    tone: string;
    bg: string;
    target: DiscoveryTab;
  }[] = [
    {
      label: "Documents",
      value: documentCount,
      tone: "text-text-primary",
      bg: "bg-surface-raised",
      target: "documents",
    },
    {
      label: "Pending Findings",
      value: pendingFindingsCount,
      tone: pendingFindingsCount > 0 ? "text-status-warning-fg" : "text-text-primary",
      bg: pendingFindingsCount > 0 ? "bg-status-warning-bg" : "bg-surface-raised",
      target: "findings",
    },
    {
      label: "Requirements",
      value: requirementsCount,
      tone: "text-text-primary",
      bg: "bg-surface-raised",
      target: "imported",
    },
    {
      label: "Analyzing",
      value: analyzingCount,
      tone: analyzingCount > 0 ? "text-status-info-fg" : "text-text-primary",
      bg: analyzingCount > 0 ? "bg-status-info-bg" : "bg-surface-raised",
      target: "documents",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
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
