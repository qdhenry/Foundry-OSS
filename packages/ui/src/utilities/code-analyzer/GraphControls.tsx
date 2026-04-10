"use client";

const LAYERS = [
  { key: "api", label: "API", color: "bg-blue-500" },
  { key: "service", label: "Service", color: "bg-slate-500" },
  { key: "data", label: "Data", color: "bg-green-500" },
  { key: "ui", label: "UI", color: "bg-amber-500" },
  { key: "utility", label: "Utility", color: "bg-gray-500" },
  { key: "config", label: "Config", color: "bg-cyan-500" },
  { key: "test", label: "Test", color: "bg-teal-500" },
] as const;

export interface GraphControlsProps {
  activeFilters: Set<string>;
  onFilterToggle: (layer: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  nodeCount: number;
}

export function GraphControls({
  activeFilters,
  onFilterToggle,
  searchQuery,
  onSearchChange,
  nodeCount,
}: GraphControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border-default bg-surface-secondary p-3">
      {/* Layer filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Layers:</span>
        {LAYERS.map((layer) => {
          const isActive = activeFilters.has(layer.key);
          return (
            <button
              key={layer.key}
              onClick={() => onFilterToggle(layer.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? "bg-surface-default text-text-primary shadow-sm border border-border-default"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${layer.color} ${!isActive ? "opacity-40" : ""}`}
              />
              {layer.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-text-muted">{nodeCount} nodes</span>
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes..."
            className="h-8 rounded-lg border border-border-default bg-surface-default pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
          />
        </div>
      </div>
    </div>
  );
}
