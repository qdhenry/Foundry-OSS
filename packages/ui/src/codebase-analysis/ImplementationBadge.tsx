"use client";

import { AlertCircle, CheckCircle, HelpCircle, XCircle } from "lucide-react";

interface ImplementationBadgeProps {
  status: string | undefined;
  confidence: number | undefined;
  lastAnalyzedAt: number | undefined;
}

const STATUS_CONFIG: Record<
  string,
  {
    icon: typeof CheckCircle;
    label: string;
    bgClass: string;
    textClass: string;
    iconClass: string;
  }
> = {
  fully_implemented: {
    icon: CheckCircle,
    label: "Implemented",
    bgClass: "bg-status-success-bg",
    textClass: "text-status-success-fg",
    iconClass: "text-status-success-fg",
  },
  partially_implemented: {
    icon: AlertCircle,
    label: "Partial",
    bgClass: "bg-status-warning-bg",
    textClass: "text-status-warning-fg",
    iconClass: "text-status-warning-fg",
  },
  not_found: {
    icon: XCircle,
    label: "Not found",
    bgClass: "bg-status-error-bg",
    textClass: "text-status-error-fg",
    iconClass: "text-status-error-fg",
  },
  needs_verification: {
    icon: HelpCircle,
    label: "Verify",
    bgClass: "bg-status-info-bg",
    textClass: "text-status-info-fg",
    iconClass: "text-status-info-fg",
  },
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ImplementationBadge({
  status,
  confidence,
  lastAnalyzedAt,
}: ImplementationBadgeProps) {
  if (!status || !lastAnalyzedAt) return null;

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;
  const timeStr = formatRelativeTime(lastAnalyzedAt);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}
      title={`${config.label} (${confidence}% confidence, analyzed ${timeStr})`}
    >
      <Icon className={`h-3 w-3 ${config.iconClass}`} />
      <span>{config.label}</span>
      {confidence !== undefined && <span className="opacity-70">{confidence}%</span>}
      <span className="opacity-60">{timeStr}</span>
    </span>
  );
}
