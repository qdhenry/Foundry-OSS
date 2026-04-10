"use client";

import { ALL_SERVICES, SERVICE_CONFIGS } from "../../resilience/constants";
import { useResilienceState } from "../../resilience/ResilienceProvider";
import type { ServiceName } from "../../resilience/types";
import { StatusDot } from "./StatusDot";

export function StatusBarPopover({ onClose }: { onClose: () => void }) {
  const state = useResilienceState();

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border-default bg-surface-raised p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Service Health</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary"
          aria-label="Close"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {ALL_SERVICES.map((service: ServiceName) => {
          const health = state.services[service];
          const config = SERVICE_CONFIGS[service];
          return (
            <div
              key={service}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-interactive-subtle"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={health?.status ?? "unknown"} />
                <span className="text-sm text-text-primary">{config.displayName}</span>
              </div>
              <span className="text-xs capitalize text-text-muted">
                {health?.status ?? "unknown"}
              </span>
            </div>
          );
        })}
      </div>

      {!state.networkOnline && (
        <div className="mt-3 rounded-lg bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg">
          Your internet connection appears to be offline
        </div>
      )}

      <div className="mt-3 border-t border-border-subtle pt-2">
        <a href="/status" className="text-xs font-medium text-text-link hover:text-text-link-hover">
          View status page
        </a>
      </div>
    </div>
  );
}
