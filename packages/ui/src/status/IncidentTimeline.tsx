"use client";

import { useState } from "react";

interface TimelineEntry {
  timestamp: number;
  status: string;
  message: string;
  updatedBy?: string;
}

interface Incident {
  _id: string;
  service: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  affectedComponents: string[];
  timeline: TimelineEntry[];
  startedAt: number;
  resolvedAt?: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  minor: "bg-status-info-bg text-status-info-fg",
  major: "bg-status-warning-bg text-status-warning-fg",
  critical: "bg-status-error-bg text-status-error-fg",
};

const STATUS_STYLES: Record<string, string> = {
  investigating: "text-status-error-fg",
  identified: "text-status-warning-fg",
  monitoring: "text-status-info-fg",
  resolved: "text-status-success-fg",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startMs: number, endMs?: number): string {
  const ms = (endMs ?? Date.now()) - startMs;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function IncidentTimeline({ incidents }: { incidents: Incident[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {incidents.map((incident) => (
        <div
          key={incident._id}
          className="rounded-xl border border-border-default bg-surface-default"
        >
          <button
            type="button"
            onClick={() => toggle(incident._id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-interactive-subtle"
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold capitalize ${STATUS_STYLES[incident.status]}`}
              >
                {incident.status}
              </span>
              <span className="text-sm text-text-primary">{incident.title}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_STYLES[incident.severity]}`}
              >
                {incident.severity}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{formatDuration(incident.startedAt, incident.resolvedAt)}</span>
              <span>{formatTime(incident.startedAt)}</span>
              <svg
                className={`h-4 w-4 transition-transform ${expanded.has(incident._id) ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expanded.has(incident._id) && (
            <div className="border-t border-border-subtle px-4 py-3">
              {incident.affectedComponents.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {incident.affectedComponents.map((comp) => (
                    <span
                      key={comp}
                      className="rounded-md bg-surface-elevated px-2 py-0.5 text-xs text-text-muted"
                    >
                      {comp}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-2 border-l-2 border-border-subtle pl-4">
                {incident.timeline.map((entry, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border-default" />
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-text-muted">{formatTime(entry.timestamp)}</span>
                      <span
                        className={`text-xs font-medium capitalize ${STATUS_STYLES[entry.status] ?? "text-text-secondary"}`}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary">{entry.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
