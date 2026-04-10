"use client";

import type { MockWorkstream } from "./pipeline-types";

interface WorkstreamFilterTabsProps {
  workstreams: MockWorkstream[];
  activeFilter: string | null;
  onFilterChange: (id: string | null) => void;
}

export function WorkstreamFilterTabs({
  workstreams,
  activeFilter,
  onFilterChange,
}: WorkstreamFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All tab */}
      <button
        onClick={() => onFilterChange(null)}
        className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
          activeFilter === null
            ? "bg-surface-raised font-medium text-text-heading"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        All
      </button>

      {/* Workstream tabs */}
      {workstreams.map((ws) => (
        <button
          key={ws.id}
          onClick={() => onFilterChange(ws.id)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            activeFilter === ws.id
              ? "bg-surface-raised font-medium text-text-heading"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ws.color }} />
          {ws.name}
        </button>
      ))}
    </div>
  );
}
