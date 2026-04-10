"use client";

import { useResilienceState } from "../../resilience/ResilienceProvider";

export function ReadOnlyModeBanner() {
  const { readOnlyMode } = useResilienceState();

  if (!readOnlyMode) return null;

  return (
    <div
      className="flex items-center gap-2 border-b border-status-warning-border bg-status-warning-bg px-6 py-2"
      role="status"
    >
      <svg
        className="h-4 w-4 shrink-0 text-status-warning-fg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
      <p className="text-sm text-status-warning-fg">
        Changes cannot be saved while reconnecting to the database
      </p>
    </div>
  );
}
