"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_SERVICES } from "../../resilience/constants";
import { useResilienceState } from "../../resilience/ResilienceProvider";
import type { ServiceStatus } from "../../resilience/types";
import { StatusBarPopover } from "./StatusBarPopover";
import { StatusDot } from "./StatusDot";

function getOverallStatus(services: Record<string, { status: ServiceStatus }>): {
  status: ServiceStatus;
  summary: string;
} {
  let outageCount = 0;
  let degradedCount = 0;

  for (const service of ALL_SERVICES) {
    const health = services[service];
    if (health?.status === "outage") outageCount++;
    else if (health?.status === "degraded") degradedCount++;
  }

  if (outageCount > 0) {
    return {
      status: "outage",
      summary: `${outageCount} service${outageCount > 1 ? "s" : ""} down`,
    };
  }
  if (degradedCount > 0) {
    return {
      status: "degraded",
      summary: `${degradedCount} service${degradedCount > 1 ? "s" : ""} degraded`,
    };
  }
  return { status: "healthy", summary: "All systems operational" };
}

export function GlobalStatusBar() {
  const state = useResilienceState();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { status, summary } = getOverallStatus(state.services);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Don't render if everything is healthy (minimal UI footprint)
  if (status === "healthy" && !isOpen) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-interactive-subtle"
          aria-label="Service health status"
        >
          <StatusDot status="healthy" />
        </button>
        {isOpen && <StatusBarPopover onClose={() => setIsOpen(false)} />}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1 text-xs hover:bg-interactive-subtle"
        aria-label="Service health status"
      >
        <StatusDot status={status} />
        <span className="text-text-secondary">{summary}</span>
      </button>
      {isOpen && <StatusBarPopover onClose={() => setIsOpen(false)} />}
    </div>
  );
}
