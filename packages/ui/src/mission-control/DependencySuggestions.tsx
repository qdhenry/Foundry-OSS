"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

interface DependencySuggestionsProps {
  programId: string;
}

type DependencySuggestion = {
  _id: string;
  aiConfidence?: number;
  dependencyType?: string;
  description?: string;
  sourceWorkstream?: { name?: string } | null;
  targetWorkstream?: { name?: string } | null;
};

const typeLabels: Record<string, string> = {
  blocks: "Blocks",
  enables: "Enables",
  conflicts: "Conflicts",
};

export function DependencySuggestions({ programId }: DependencySuggestionsProps) {
  const suggestions = useQuery("dependencyDetection:getPendingSuggestions" as any, {
    programId,
  }) as DependencySuggestion[] | undefined;

  const approveDep = useMutation("dependencyDetection:approveDependency" as any) as (args: {
    dependencyId: string;
  }) => Promise<void>;
  const dismissDep = useMutation("dependencyDetection:dismissDependency" as any) as (args: {
    dependencyId: string;
  }) => Promise<void>;

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const handleApprove = async (depId: string) => {
    setLoadingIds((prev) => new Set(prev).add(depId));
    try {
      await approveDep({ dependencyId: depId });
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(depId);
        return next;
      });
    }
  };

  const handleDismiss = async (depId: string) => {
    setLoadingIds((prev) => new Set(prev).add(depId));
    try {
      await dismissDep({ dependencyId: depId });
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(depId);
        return next;
      });
    }
  };

  if (suggestions === undefined) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-heading">AI-Suggested Dependencies</h2>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-border-default bg-surface-raised"
            />
          ))}
        </div>
      </section>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-text-heading">
        AI-Suggested Dependencies
        <span className="ml-2 text-sm font-normal text-text-secondary">
          ({suggestions.length} pending review)
        </span>
      </h2>

      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const isLoading = loadingIds.has(suggestion._id);
          const confidence = suggestion.aiConfidence ?? 0;
          const confidenceBg =
            confidence >= 80
              ? "bg-status-success-bg text-status-success-fg"
              : confidence >= 60
                ? "bg-status-warning-bg text-status-warning-fg"
                : "bg-surface-elevated text-text-secondary";

          return (
            <div
              key={suggestion._id}
              className="rounded-lg border border-border-default bg-surface-default p-4 transition-colors hover:border-border-default"
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-heading">
                    {suggestion.sourceWorkstream?.name ?? "Unknown"}
                    <span className="mx-2 text-text-muted">{"\u2192"}</span>
                    {suggestion.targetWorkstream?.name ?? "Unknown"}
                  </p>
                  {suggestion.description && (
                    <p className="mt-1 text-sm text-text-secondary">{suggestion.description}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBg}`}
                >
                  {confidence}% confidence
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  {suggestion.dependencyType && (
                    <span>
                      Type:{" "}
                      <span className="font-medium">
                        {typeLabels[suggestion.dependencyType] ?? suggestion.dependencyType}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDismiss(suggestion._id)}
                    disabled={isLoading}
                    className="rounded-md border border-border-default bg-surface-default px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleApprove(suggestion._id)}
                    disabled={isLoading}
                    className="rounded-md bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Approve"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
