"use client";

const LAYER_COLORS: Record<string, string> = {
  api: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  service: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  data: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  ui: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  utility: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
  config: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  test: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

const TYPE_COLORS: Record<string, string> = {
  file: "bg-surface-raised text-text-secondary",
  function: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  class: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  module: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
};

export interface NodeDetailPanelProps {
  node: any | null;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  return (
    <div
      className={`fixed right-0 top-0 z-50 h-full w-96 border-l border-border-default bg-surface-default shadow-xl transition-all duration-300 ${
        node ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      {node && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border-default p-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-text-heading">{node.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {node.type && (
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      TYPE_COLORS[node.type] ?? TYPE_COLORS.file
                    }`}
                  >
                    {node.type}
                  </span>
                )}
                {node.layer && (
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      LAYER_COLORS[node.layer] ?? LAYER_COLORS.utility
                    }`}
                  >
                    {node.layer}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-2 shrink-0 rounded-lg p-1.5 text-text-muted transition-all duration-200 hover:bg-surface-secondary hover:text-text-primary"
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

          {/* Content */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {node.language && (
              <div>
                <dt className="text-xs font-medium text-text-muted">Language</dt>
                <dd className="mt-0.5 text-sm text-text-primary">{node.language}</dd>
              </div>
            )}

            {node.filePath && (
              <div>
                <dt className="text-xs font-medium text-text-muted">File Path</dt>
                <dd className="mt-0.5 break-all text-sm font-mono text-text-primary">
                  {node.filePath}
                </dd>
              </div>
            )}

            {(node.lineStart || node.lineEnd) && (
              <div>
                <dt className="text-xs font-medium text-text-muted">Line Range</dt>
                <dd className="mt-0.5 text-sm font-mono text-text-primary">
                  {node.lineStart}
                  {node.lineEnd ? ` - ${node.lineEnd}` : ""}
                </dd>
              </div>
            )}

            {node.description && (
              <div>
                <dt className="text-xs font-medium text-text-muted">Description</dt>
                <dd className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {node.description}
                </dd>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
