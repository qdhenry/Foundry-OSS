"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { type PatternSnippet, SnippetCard } from "./SnippetCard";

type TargetPlatform = "salesforce_b2b" | "bigcommerce_b2b" | "platform_agnostic";

interface Filters {
  targetPlatform?: TargetPlatform;
  requirementCategory?: string;
  language?: string;
  search?: string;
}

const PLATFORM_OPTIONS: { value: TargetPlatform; label: string }[] = [
  { value: "salesforce_b2b", label: "Salesforce B2B" },
  { value: "bigcommerce_b2b", label: "BigCommerce B2B" },
  { value: "platform_agnostic", label: "Platform Agnostic" },
];

const LANGUAGE_OPTIONS = [
  "TypeScript",
  "JavaScript",
  "Apex",
  "SQL",
  "GraphQL",
  "PHP",
  "Python",
  "HTML",
  "CSS",
];

export interface PatternsPageProps {
  programId: string;
  programSlug?: string;
}

export function PatternsPage({ programId }: PatternsPageProps) {
  const [filters, setFilters] = useState<Filters>({});

  const snippets = useQuery(
    "sourceControl/patterns/snippetStorage:listSnippets" as any,
    programId
      ? {
          programId: programId as any,
          ...(filters.targetPlatform ? { targetPlatform: filters.targetPlatform } : {}),
          ...(filters.requirementCategory
            ? { requirementCategory: filters.requirementCategory }
            : {}),
          ...(filters.language ? { language: filters.language } : {}),
        }
      : "skip",
  ) as PatternSnippet[] | undefined;

  const filteredSnippets = useMemo(() => {
    if (!snippets) return [];
    if (!filters.search) return snippets;

    const query = filters.search.toLowerCase();
    return snippets.filter(
      (snippet) =>
        snippet.title.toLowerCase().includes(query) ||
        snippet.description.toLowerCase().includes(query) ||
        snippet.code.toLowerCase().includes(query),
    );
  }, [snippets, filters.search]);

  const categories = useMemo(() => {
    if (!snippets) return [];
    const categorySet = new Set<string>();
    for (const snippet of snippets) {
      if (snippet.requirementCategory) {
        categorySet.add(snippet.requirementCategory);
      }
    }
    return Array.from(categorySet).sort();
  }, [snippets]);

  const hasActiveFilters =
    Boolean(filters.targetPlatform) ||
    Boolean(filters.requirementCategory) ||
    Boolean(filters.language) ||
    Boolean(filters.search);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-display-m text-text-heading">Pattern Library</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Anonymized code patterns from completed migrations
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="form-label">Search</label>
          <input
            type="text"
            placeholder="Search patterns..."
            value={filters.search ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value || undefined })
            }
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="form-label">Category</label>
          <select
            value={filters.requirementCategory ?? ""}
            onChange={(event) =>
              setFilters({
                ...filters,
                requirementCategory: event.target.value || undefined,
              })
            }
            className="select"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="form-label">Platform</label>
          <select
            value={filters.targetPlatform ?? ""}
            onChange={(event) =>
              setFilters({
                ...filters,
                targetPlatform: (event.target.value || undefined) as TargetPlatform | undefined,
              })
            }
            className="select"
          >
            <option value="">All Platforms</option>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="form-label">Language</label>
          <select
            value={filters.language ?? ""}
            onChange={(event) =>
              setFilters({
                ...filters,
                language: event.target.value || undefined,
              })
            }
            className="select"
          >
            <option value="">All Languages</option>
            {LANGUAGE_OPTIONS.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button onClick={() => setFilters({})} className="btn-ghost btn-sm">
            Clear filters
          </button>
        )}
      </div>

      {snippets === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading patterns...</p>
        </div>
      ) : filteredSnippets.length === 0 ? (
        <div className="card rounded-xl border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">No code patterns available yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Patterns are mined from completed migrations and shared across the platform.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredSnippets.map((snippet) => (
            <SnippetCard key={snippet._id} snippet={snippet} />
          ))}
        </div>
      )}
    </div>
  );
}
