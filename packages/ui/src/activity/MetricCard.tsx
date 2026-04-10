// packages/ui/src/activity/MetricCard.tsx
"use client";

interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  colorClass: string;
  bgClass?: string;
  onClick: () => void;
}

export function MetricCard({
  label,
  value,
  subtitle,
  colorClass,
  bgClass = "bg-surface-raised",
  onClick,
}: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${bgClass} w-full rounded-xl border border-border-default p-4 text-left transition-colors hover:bg-interactive-hover focus:outline-none focus:ring-1 focus:ring-accent-default`}
    >
      <p className="type-caption normal-case text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
      <p className="mt-0.5 type-caption normal-case tracking-normal text-text-secondary">
        {subtitle}
      </p>
    </button>
  );
}
