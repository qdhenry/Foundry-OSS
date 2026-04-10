"use client";

import { useQuery } from "convex/react";
import { ALL_SERVICES, SERVICE_CONFIGS } from "../resilience/constants";
import { useResilienceState } from "../resilience/ResilienceProvider";
import type { ServiceName } from "../resilience/types";
import { IncidentTimeline } from "./IncidentTimeline";
import { ServiceHealthCard } from "./ServiceHealthCard";

export function StatusPageRoute({ orgId }: { orgId?: string }) {
  const state = useResilienceState();

  const activeIncidents = useQuery(
    "health/serviceHealth:getActiveIncidents" as any,
    orgId ? { orgId } : "skip",
  );

  const incidentHistory = useQuery(
    "health/serviceHealth:getIncidentHistory" as any,
    orgId ? { orgId, limit: 20 } : "skip",
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="type-display-m text-text-heading">System Status</h1>
        <p className="mt-1 text-sm text-text-secondary">Current health of all Foundry services</p>
      </div>

      {!state.networkOnline && (
        <div className="card mb-6 rounded-xl border-status-warning-border bg-status-warning-bg p-4">
          <p className="text-sm font-medium text-status-warning-fg">
            Your internet connection appears to be offline
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Service status may not be accurate until your connection is restored.
          </p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_SERVICES.map((service: ServiceName) => {
          const health = state.services[service];
          const config = SERVICE_CONFIGS[service];
          return (
            <ServiceHealthCard
              key={service}
              serviceName={config.displayName}
              status={health?.status ?? "unknown"}
              circuitState={health?.circuitState ?? "closed"}
              activeRetries={health?.activeRetries ?? 0}
              message={health?.message}
              critical={config.critical}
            />
          );
        })}
      </div>

      {activeIncidents && activeIncidents.length > 0 && (
        <div className="mb-8">
          <h2 className="type-heading-m mb-4 text-text-heading">Active Incidents</h2>
          <IncidentTimeline incidents={activeIncidents} />
        </div>
      )}

      <div>
        <h2 className="type-heading-m mb-4 text-text-heading">Incident History</h2>
        {incidentHistory === undefined ? (
          <p className="text-sm text-text-muted">Loading incident history...</p>
        ) : incidentHistory.length === 0 ? (
          <div className="card flex flex-col items-center justify-center rounded-xl border-dashed py-12">
            <p className="text-sm text-text-muted">No incidents recorded</p>
            <p className="mt-1 text-xs text-text-muted">
              Incidents will appear here when service issues are detected
            </p>
          </div>
        ) : (
          <IncidentTimeline incidents={incidentHistory} />
        )}
      </div>
    </div>
  );
}
