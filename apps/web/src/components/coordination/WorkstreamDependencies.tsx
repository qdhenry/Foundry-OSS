"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DependencyManager } from "./DependencyManager";

interface WorkstreamDependenciesProps {
  programId: Id<"programs">;
  orgId: string;
}

type DependencyListItem = {
  _id: Id<"workstreamDependencies">;
  status: string;
  description?: string;
  sourceWorkstream?: { shortCode?: string; name?: string } | null;
  targetWorkstream?: { shortCode?: string; name?: string } | null;
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: {
    bg: "bg-status-info-bg",
    text: "text-status-info-fg",
    label: "Active",
  },
  resolved: {
    bg: "bg-status-success-bg",
    text: "text-status-success-fg",
    label: "Resolved",
  },
  blocked: {
    bg: "bg-status-error-bg",
    text: "text-status-error-fg",
    label: "Blocked",
  },
};

export function WorkstreamDependencies({ programId, orgId }: WorkstreamDependenciesProps) {
  const dependencies = useQuery(api.workstreamDependencies.listByProgram, { programId });
  const removeDep = useMutation(api.workstreamDependencies.remove);
  const updateStatus = useMutation(api.workstreamDependencies.updateStatus);

  const [showForm, setShowForm] = useState(false);
  const [editingDep, setEditingDep] = useState<
    (typeof dependencies extends (infer T)[] | undefined ? T : never) | null
  >(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (dependencies === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
    );
  }

  const handleRemove = async (depId: Id<"workstreamDependencies">) => {
    await removeDep({ dependencyId: depId });
  };

  const handleStatusToggle = async (depId: Id<"workstreamDependencies">, currentStatus: string) => {
    const nextStatus =
      currentStatus === "active" ? "resolved" : currentStatus === "resolved" ? "blocked" : "active";
    await updateStatus({
      dependencyId: depId,
      status: nextStatus as "active" | "resolved" | "blocked",
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-heading">Workstream Dependencies</h3>
        <button
          onClick={() => {
            setEditingDep(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
        >
          {/* Plus icon */}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Dependency
        </button>
      </div>

      {/* Form (inline) */}
      {showForm && (
        <div className="mb-4">
          <DependencyManager
            programId={programId}
            orgId={orgId}
            dependency={editingDep ?? undefined}
            onClose={() => {
              setShowForm(false);
              setEditingDep(null);
            }}
          />
        </div>
      )}

      {/* Empty state */}
      {dependencies.length === 0 && !showForm && (
        <div className="rounded-xl border border-border-default bg-surface-default p-8 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.182-9.182l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757"
            />
          </svg>
          <p className="text-sm text-text-secondary">
            No dependencies defined yet. Add one to track cross-workstream relationships.
          </p>
        </div>
      )}

      {/* Dependency list */}
      {dependencies.length > 0 && (
        <div className="space-y-2">
          {dependencies.map((dep: DependencyListItem) => {
            const badge = STATUS_BADGE[dep.status] ?? STATUS_BADGE.active;
            const isExpanded = expandedId === dep._id;

            return (
              <div
                key={dep._id}
                className="rounded-lg border border-border-default bg-surface-default transition-colors"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Source */}
                  <span className="shrink-0 rounded bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-primary">
                    {dep.sourceWorkstream?.shortCode ?? "???"}
                  </span>

                  {/* Arrow */}
                  <svg
                    className="h-4 w-4 shrink-0 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>

                  {/* Target */}
                  <span className="shrink-0 rounded bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-primary">
                    {dep.targetWorkstream?.shortCode ?? "???"}
                  </span>

                  {/* Description preview */}
                  <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                    {dep.description || "No description"}
                  </span>

                  {/* Status badge */}
                  <button
                    onClick={() => handleStatusToggle(dep._id, dep.status)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text} cursor-pointer transition-opacity hover:opacity-80`}
                    title="Click to cycle status"
                  >
                    {badge.label}
                  </button>

                  {/* Expand/collapse */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : dep._id)}
                    className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border-default px-4 py-3">
                    <div className="mb-2 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium text-text-secondary">Source:</span>{" "}
                        <span className="text-text-heading">
                          {dep.sourceWorkstream?.name ?? "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-text-secondary">Target:</span>{" "}
                        <span className="text-text-heading">
                          {dep.targetWorkstream?.name ?? "Unknown"}
                        </span>
                      </div>
                    </div>
                    {dep.description && (
                      <p className="mb-3 text-xs text-text-primary">{dep.description}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingDep(dep);
                          setShowForm(true);
                        }}
                        className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-interactive-hover"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemove(dep._id)}
                        className="rounded-md bg-status-error-bg px-2.5 py-1 text-xs font-medium text-status-error-fg transition-colors hover:opacity-80"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
