"use client";

import type { CircuitState, ServiceStatus } from "../resilience/types";

interface ServiceHealthCardProps {
  serviceName: string;
  status: ServiceStatus;
  circuitState: CircuitState;
  activeRetries: number;
  message?: string;
  critical?: boolean;
}

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: "bg-status-success-fg",
  degraded: "bg-status-warning-fg",
  outage: "bg-status-error-fg",
  unknown: "bg-text-muted",
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  healthy: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  unknown: "Unknown",
};

export function ServiceHealthCard({
  serviceName,
  status,
  circuitState,
  activeRetries,
  message,
  critical,
}: ServiceHealthCardProps) {
  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-sm font-medium text-text-primary">{serviceName}</span>
        </div>
        {critical && (
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase text-text-muted">
            Critical
          </span>
        )}
      </div>

      <p className="mt-2 text-xs font-medium text-text-secondary">{STATUS_LABELS[status]}</p>

      {message && <p className="mt-1 text-xs text-text-muted">{message}</p>}

      {activeRetries > 0 && (
        <p className="mt-1 text-xs text-status-warning-fg">
          {activeRetries} active retr{activeRetries > 1 ? "ies" : "y"}
        </p>
      )}

      {circuitState !== "closed" && (
        <div className="mt-2">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${
              circuitState === "open"
                ? "bg-status-error-bg text-status-error-fg"
                : "bg-status-warning-bg text-status-warning-fg"
            }`}
          >
            Circuit {circuitState === "open" ? "open" : "half-open"}
          </span>
        </div>
      )}
    </div>
  );
}
