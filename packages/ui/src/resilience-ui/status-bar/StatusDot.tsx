"use client";

import type { ServiceStatus } from "../../resilience/types";

const STATUS_STYLES: Record<ServiceStatus, string> = {
  healthy: "bg-status-success-fg",
  degraded: "bg-status-warning-fg animate-pulse",
  outage: "bg-status-error-fg",
  unknown: "bg-text-muted",
};

export function StatusDot({ status }: { status: ServiceStatus }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${STATUS_STYLES[status]}`}
      aria-label={`Status: ${status}`}
      role="status"
    />
  );
}
