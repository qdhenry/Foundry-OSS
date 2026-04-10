"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertCircle, CheckCircle, GitBranch, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import * as generatedApi from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface RequirementRefinementPanelProps {
  requirementId: Id<"requirements">;
  programId: Id<"programs">;
}

const api: any = (generatedApi as any).api;

const CATEGORY_BADGE: Record<string, string> = {
  clarity: "bg-status-info-bg text-accent-default",
  completeness: "bg-surface-raised text-text-secondary",
  scope: "bg-status-warning-bg text-status-warning-fg",
  testability: "bg-status-success-bg text-status-success-fg",
  feasibility: "bg-status-warning-bg text-status-warning-fg",
  priority: "bg-orange-100 text-orange-700",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  major: "bg-orange-100 text-orange-700",
  minor: "bg-status-warning-bg text-status-warning-fg",
  suggestion: "bg-surface-raised text-text-secondary",
};

export function RequirementRefinementPanel({
  requirementId,
  programId,
}: RequirementRefinementPanelProps) {
  const data = useQuery(api.requirementRefinement.getRefinementSuggestions, {
    requirementId,
  });

  const requestRefinement = useMutation(api.requirementRefinement.requestRefinement);

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [splitAccepted, setSplitAccepted] = useState(false);

  // Derive processing state from reactive data
  const isProcessing = data?.status === "processing";
  const isError = data?.status === "error";

  async function handleRequestRefinement() {
    await requestRefinement({ requirementId });
  }

  // Loading (initial query resolution)
  if (data === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading refinement suggestions...</p>
        </div>
      </div>
    );
  }

  // Processing state — AI is working
  if (isProcessing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-status-info-bg p-6">
        <div className="flex flex-col items-center py-6">
          <Loader2 size={32} className="mb-3 animate-spin text-accent-default" />
          <p className="text-sm font-medium text-blue-800">Analyzing requirement...</p>
          <p className="mt-1 text-xs text-accent-default">
            AI is evaluating clarity, completeness, and testability. This typically takes 10-30
            seconds.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-status-error-bg p-6">
        <div className="flex flex-col items-center py-6">
          <AlertCircle size={32} className="mb-3 text-status-error-fg" />
          <p className="text-sm font-medium text-red-800">Refinement analysis failed</p>
          <p className="mt-1 max-w-sm text-center text-xs text-status-error-fg">
            {data.error ?? "An unexpected error occurred while analyzing the requirement."}
          </p>
          <button
            onClick={handleRequestRefinement}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data yet
  if (!data) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex flex-col items-center py-6">
          <Sparkles size={32} className="mb-3 text-accent-default" />
          <p className="text-sm font-medium text-text-heading">No refinement suggestions yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Request an AI analysis to get improvement suggestions.
          </p>
          <button
            onClick={handleRequestRefinement}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Request Refinement
          </button>
        </div>
      </div>
    );
  }

  const suggestions = data.suggestions as {
    overall_assessment?: string;
    suggestions?: Array<{
      category: string;
      severity: string;
      suggestion: string;
      example_resolution?: string;
    }>;
    potential_split?: {
      recommended: boolean;
      rationale?: string;
      proposed_parts?: Array<{ title: string; description: string }>;
    };
  };

  const items = suggestions?.suggestions ?? [];
  const split = suggestions?.potential_split;

  return (
    <div className="space-y-4">
      {/* Overall Assessment */}
      {suggestions?.overall_assessment && (
        <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
          <h4 className="mb-1 text-sm font-semibold text-blue-800">Overall Assessment</h4>
          <p className="text-xs text-accent-default">{suggestions.overall_assessment}</p>
        </div>
      )}

      {/* Suggestions list */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 text-sm font-semibold text-text-heading">
            Suggestions ({items.length})
          </h4>
          <div className="space-y-3">
            {items.map((item, i) => {
              if (dismissed.has(i)) return null;
              const isApplied = applied.has(i);
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    isApplied ? "border-green-200 bg-status-success-bg" : "border-border-default"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE.clarity
                      }`}
                    >
                      {item.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.suggestion
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-xs text-text-primary">{item.suggestion}</p>
                  {item.example_resolution && (
                    <p className="mt-1.5 rounded bg-surface-raised px-2 py-1 text-[11px] text-text-secondary">
                      <span className="font-medium">Example:</span> {item.example_resolution}
                    </p>
                  )}
                  {!isApplied && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setApplied((prev) => new Set(prev).add(i))}
                        className="flex items-center gap-1 rounded-lg bg-status-success-bg px-2.5 py-1 text-xs font-medium text-status-success-fg transition-colors hover:bg-status-success-bg"
                      >
                        <CheckCircle size={12} />
                        Apply
                      </button>
                      <button
                        onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                        className="flex items-center gap-1 rounded-lg bg-surface-raised px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated"
                      >
                        <X size={12} />
                        Dismiss
                      </button>
                    </div>
                  )}
                  {isApplied && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-status-success-fg">
                      <CheckCircle size={12} />
                      Applied
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Potential Split */}
      {split?.recommended && (
        <div className="rounded-xl border border-amber-200 bg-status-warning-bg p-4">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <GitBranch size={16} />
            Split Recommended
          </h4>
          {split.rationale && (
            <p className="mb-3 text-xs text-status-warning-fg">{split.rationale}</p>
          )}
          {split.proposed_parts && split.proposed_parts.length > 0 && (
            <div className="mb-3 space-y-2">
              {split.proposed_parts.map((part, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-amber-200 bg-surface-default p-2.5"
                >
                  <p className="text-xs font-medium text-text-heading">{part.title}</p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">{part.description}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setSplitAccepted(true)}
            disabled={splitAccepted}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              splitAccepted
                ? "cursor-default bg-status-success-bg text-status-success-fg"
                : "bg-accent-default text-text-on-brand hover:bg-accent-strong"
            }`}
          >
            {splitAccepted ? "Split Accepted" : "Accept Split"}
          </button>
        </div>
      )}

      {/* Re-request button */}
      <div className="flex justify-end">
        <button
          onClick={handleRequestRefinement}
          disabled={isProcessing}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          Request Refinement
        </button>
      </div>
    </div>
  );
}
