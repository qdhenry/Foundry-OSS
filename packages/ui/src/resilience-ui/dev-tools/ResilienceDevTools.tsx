"use client";

import { useEffect, useState } from "react";
import { ALL_SERVICES, SERVICE_CONFIGS } from "../../resilience/constants";
import { useResilience } from "../../resilience/ResilienceProvider";
import type { CircuitState, ServiceName } from "../../resilience/types";

type ConnectionState = "connected" | "disconnected" | "reconnecting";

export function ResilienceDevTools() {
  const { registry, connectionMonitor, networkDetector, state } = useResilience();
  const [isOpen, setIsOpen] = useState(false);

  // Track connection + network state for display
  const [connState, setConnState] = useState<ConnectionState>("connected");
  const [netOnline, setNetOnline] = useState(true);
  // Track circuit states for toggle buttons
  const [circuitStates, setCircuitStates] = useState<Map<ServiceName, CircuitState>>(() => {
    const m = new Map<ServiceName, CircuitState>();
    for (const [svc, s] of registry.getAll()) m.set(svc, s.state);
    return m;
  });

  useEffect(() => {
    return connectionMonitor.subscribe((s) => setConnState(s));
  }, [connectionMonitor]);

  useEffect(() => {
    return networkDetector.subscribe((s) => setNetOnline(s === "online" || s === "service_outage"));
  }, [networkDetector]);

  useEffect(() => {
    return registry.subscribe((svc, s) => {
      setCircuitStates((prev) => {
        const next = new Map(prev);
        next.set(svc, s.state);
        return next;
      });
    });
  }, [registry]);

  if (process.env.NODE_ENV !== "development") return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[9999] flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-text-muted shadow-lg ring-1 ring-border-default hover:bg-interactive-subtle hover:text-text-primary"
        title="Resilience Dev Tools"
      >
        R
      </button>
    );
  }

  const toggleService = (service: ServiceName) => {
    const current = circuitStates.get(service) ?? "closed";
    if (current === "closed") {
      registry.simulateOutage(service);
    } else {
      registry.simulateRecovery(service);
    }
  };

  const toggleConnection = () => {
    if (connState === "connected") {
      connectionMonitor.simulateDisconnect();
    } else {
      connectionMonitor.simulateReconnect();
    }
  };

  const toggleNetwork = () => {
    if (netOnline) {
      networkDetector.simulateOffline();
    } else {
      networkDetector.simulateOnline();
    }
  };

  const simulateAllDown = () => {
    for (const svc of ALL_SERVICES) registry.simulateOutage(svc);
    connectionMonitor.simulateDisconnect();
    networkDetector.simulateOffline();
  };

  const recoverAll = () => {
    for (const svc of ALL_SERVICES) registry.simulateRecovery(svc);
    connectionMonitor.simulateReconnect();
    networkDetector.simulateOnline();
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-80 rounded-xl border border-border-default bg-surface-raised shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <h3 className="text-sm font-semibold text-text-primary">Resilience Dev Tools</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-text-muted hover:text-text-primary"
          aria-label="Close dev tools"
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

      <div className="max-h-[60vh] overflow-y-auto p-3">
        {/* Infrastructure toggles */}
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
            Infrastructure
          </p>
          <div className="space-y-1">
            <ToggleRow
              label="Convex Connection"
              active={connState !== "connected"}
              onToggle={toggleConnection}
            />
            <ToggleRow label="Network" active={!netOnline} onToggle={toggleNetwork} />
          </div>
        </div>

        {/* Service circuit breakers */}
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
            Services
          </p>
          <div className="space-y-1">
            {ALL_SERVICES.map((service) => {
              const circuitState = circuitStates.get(service) ?? "closed";
              return (
                <ToggleRow
                  key={service}
                  label={SERVICE_CONFIGS[service].displayName}
                  active={circuitState !== "closed"}
                  onToggle={() => toggleService(service)}
                  badge={circuitState !== "closed" ? circuitState : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={simulateAllDown}
            className="flex-1 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-1.5 text-xs font-medium text-status-error-fg hover:opacity-80"
          >
            Simulate All Down
          </button>
          <button
            type="button"
            onClick={recoverAll}
            className="flex-1 rounded-lg border border-status-success-border bg-status-success-bg px-3 py-1.5 text-xs font-medium text-status-success-fg hover:opacity-80"
          >
            Recover All
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  active,
  onToggle,
  badge,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-interactive-subtle">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            active ? "bg-status-error-fg" : "bg-status-success-fg"
          }`}
        />
        <span className="text-sm text-text-primary">{label}</span>
        {badge && (
          <span className="rounded bg-status-error-bg px-1.5 py-0.5 text-[10px] font-medium text-status-error-fg">
            {badge}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          active ? "bg-status-error-fg" : "bg-border-default"
        }`}
        role="switch"
        aria-checked={active}
        aria-label={`Toggle ${label} outage`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
