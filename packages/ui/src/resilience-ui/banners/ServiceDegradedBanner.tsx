"use client";

import { useState } from "react";
import { ALL_SERVICES, CRITICAL_SERVICES, SERVICE_CONFIGS } from "../../resilience/constants";
import { useResilienceState } from "../../resilience/ResilienceProvider";
import type { ServiceName } from "../../resilience/types";

export function ServiceDegradedBanner() {
  const state = useResilienceState();
  const [dismissed, setDismissed] = useState<Set<ServiceName>>(new Set());

  const degradedServices = ALL_SERVICES.filter((service) => {
    const health = state.services[service];
    return (
      health?.status === "outage" && !CRITICAL_SERVICES.includes(service) && !dismissed.has(service)
    );
  });

  if (degradedServices.length === 0) return null;

  return (
    <>
      {degradedServices.map((service) => {
        const config = SERVICE_CONFIGS[service];
        return (
          <div
            key={service}
            className="flex items-center justify-between border-b border-status-info-border bg-status-info-bg px-6 py-2"
            role="status"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-status-error-fg" />
              <p className="text-sm text-text-primary">
                {config.displayName} is currently unavailable
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set(prev).add(service))}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </>
  );
}
