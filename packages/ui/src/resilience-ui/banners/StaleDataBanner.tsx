"use client";

import { useEffect, useState } from "react";
import { useResilience } from "../../resilience/ResilienceProvider";

export function StaleDataBanner() {
  const { connectionMonitor } = useResilience();
  const [connState, setConnState] = useState(connectionMonitor.getState());

  useEffect(() => {
    return connectionMonitor.subscribe((state, staleMs) => {
      setConnState({ state, staleMs });
    });
  }, [connectionMonitor]);

  if (connState.state === "connected") return null;

  const seconds = Math.floor(connState.staleMs / 1000);

  return (
    <div
      className="flex items-center gap-2 border-b border-status-warning-border bg-status-warning-bg px-6 py-2"
      role="alert"
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
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <p className="text-sm text-status-warning-fg">
        {connState.state === "reconnecting"
          ? `Reconnecting to server... (${seconds}s)`
          : `Connection lost — showing cached data (${seconds}s ago)`}
      </p>
    </div>
  );
}
