"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface SnippetCardProps {
  snippet: {
    _id: Id<"codeSnippets">;
    title: string;
    description: string;
    code: string;
    annotations?: string;
    requirementCategory: string;
    targetPlatform: string;
    language: string;
    successRating: string;
    upvotes: number;
    flagCount: number;
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  salesforce_b2b: "Salesforce B2B",
  bigcommerce_b2b: "BigCommerce B2B",
  platform_agnostic: "Platform Agnostic",
};

const RATING_STARS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${filled ? "text-accent-default" : "text-text-muted"}`}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

export function SnippetCard({ snippet }: SnippetCardProps) {
  const upvote = useMutation(api.sourceControl.patterns.snippetStorage.upvoteSnippet);
  const flag = useMutation(api.sourceControl.patterns.snippetStorage.flagSnippet);

  const stars = RATING_STARS[snippet.successRating] ?? 3;
  const platformLabel = PLATFORM_LABELS[snippet.targetPlatform] ?? snippet.targetPlatform;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      {/* Title + description */}
      <h3 className="text-sm font-semibold text-text-heading">{snippet.title}</h3>
      <p className="mt-1 text-xs text-text-secondary line-clamp-2">{snippet.description}</p>

      {/* Code block */}
      <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-raised p-4 font-mono text-xs text-text-heading">
        <code>{snippet.code}</code>
      </pre>

      {/* Annotations */}
      {snippet.annotations && (
        <p className="mt-2 text-[10px] italic text-text-muted">{snippet.annotations}</p>
      )}

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning-fg">
          {platformLabel}
        </span>
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
          {snippet.language}
        </span>
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
          {snippet.requirementCategory}
        </span>

        {/* Success rating stars */}
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon key={i} filled={i < stars} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3 border-t border-border-default pt-3">
        <button
          onClick={() => upvote({ snippetId: snippet._id })}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          {snippet.upvotes}
        </button>
        <button
          onClick={() => flag({ snippetId: snippet._id })}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
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
              d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
            />
          </svg>
          Flag
        </button>
      </div>
    </div>
  );
}
