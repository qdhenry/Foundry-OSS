"use client";

import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

interface WorkstreamItem {
  _id: string;
  name: string;
  shortCode: string;
}

interface Suggestion {
  workstreamName: string;
  shortCode: string;
  requirementRefIds: string[];
  requirementDocIds: string[];
  rationale: string;
}

interface DiscoveryNextStepCardProps {
  unassignedCount: number;
  totalCount: number;
  workstreams: WorkstreamItem[];
  programId: string;
  slug: string;
}

export function DiscoveryNextStepCard({
  unassignedCount,
  totalCount,
  workstreams,
  programId,
  slug,
}: DiscoveryNextStepCardProps) {
  const router = useRouter();
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestGroupings = useAction("aiWorkstreamSuggestions:suggestWorkstreamGroupings" as any);

  const handleSuggest = useCallback(async () => {
    setIsLoadingSuggestions(true);
    setError(null);
    try {
      const result = await suggestGroupings({ programId });
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      } else {
        setError(result.message ?? "No suggestions generated.");
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to generate suggestions.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [programId, suggestGroupings]);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-800/50 dark:bg-blue-950/20">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
          <svg
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-heading">
            {unassignedCount} unassigned requirement{unassignedCount !== 1 ? "s" : ""}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {totalCount - unassignedCount} of {totalCount} requirements are assigned to workstreams.
            Organize the remaining to track progress effectively.
          </p>

          {/* Existing workstreams summary */}
          {workstreams.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {workstreams.map((ws) => (
                <span
                  key={ws._id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-default px-2.5 py-1 text-xs font-medium text-text-secondary"
                >
                  <span className="font-semibold text-text-primary">{ws.shortCode}</span>
                  {ws.name}
                </span>
              ))}
            </div>
          )}

          {/* AI Suggestions result */}
          {suggestions && (
            <div className="mt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Suggested Groupings
              </h4>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border-default bg-surface-default p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      {s.shortCode}
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {s.workstreamName}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({s.requirementRefIds.length} reqs)
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{s.rationale}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.requirementRefIds.map((refId: string) => (
                      <span
                        key={refId}
                        className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
                      >
                        {refId}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleSuggest}
              disabled={isLoadingSuggestions}
              className="btn-primary btn-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isLoadingSuggestions ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                    />
                  </svg>
                  AI Suggest Groupings
                </>
              )}
            </button>
            <button
              onClick={() => router.push(`/${slug}/requirements?filter=unassigned`)}
              className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-default px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
              Assign Manually
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
