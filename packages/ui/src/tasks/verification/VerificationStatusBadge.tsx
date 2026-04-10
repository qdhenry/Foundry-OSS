"use client";

import { AlertTriangle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

type VerificationStatus =
  | "pending"
  | "provisioning"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

interface VerificationStatusBadgeProps {
  status: VerificationStatus;
  checksPassed?: number;
  checksTotal?: number;
  checksFailed?: number;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    className: "bg-surface-raised text-text-secondary",
    icon: Clock,
  },
  provisioning: {
    label: "Provisioning",
    className: "bg-surface-raised text-accent-default",
    icon: Loader2,
  },
  running: {
    label: "Running",
    className: "bg-surface-raised text-accent-default",
    icon: Loader2,
  },
  completed: {
    label: "Passed",
    className: "bg-status-success-bg text-status-success-fg",
    icon: CheckCircle,
  },
  failed: {
    label: "Failed",
    className: "bg-status-error-bg text-status-error-fg",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "text-text-muted bg-surface-raised",
    icon: XCircle,
  },
};

export function VerificationStatusBadge({
  status,
  checksPassed,
  checksTotal,
  checksFailed,
}: VerificationStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Override completed label if there are failures
  const label =
    status === "completed" && checksFailed && checksFailed > 0
      ? `${checksFailed} issue${checksFailed !== 1 ? "s" : ""}`
      : status === "completed" && checksTotal
        ? `${checksPassed}/${checksTotal} passed`
        : config.label;

  const badgeClass =
    status === "completed" && checksFailed && checksFailed > 0
      ? "bg-status-warning-bg text-status-warning-fg"
      : config.className;

  const Icon =
    status === "completed" && checksFailed && checksFailed > 0 ? AlertTriangle : config.icon;

  const isAnimated = status === "provisioning" || status === "running";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
    >
      <Icon className={`h-3 w-3 ${isAnimated ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
