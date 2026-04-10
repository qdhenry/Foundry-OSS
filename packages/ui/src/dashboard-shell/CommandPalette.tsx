"use client";

import { useOrganization } from "@clerk/nextjs";
import {
  AlertTriangle,
  BookOpen01,
  Calendar,
  CheckSquare,
  ClipboardCheck,
  File06,
  FileAttachment01,
  Link01,
  SearchMd,
  User01,
} from "@untitledui/icons";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SearchResult {
  type:
    | "requirement"
    | "skill"
    | "risk"
    | "user"
    | "task"
    | "integration"
    | "document"
    | "sprint"
    | "playbook";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface SearchResults {
  requirements: SearchResult[];
  skills: SearchResult[];
  risks: SearchResult[];
  users: SearchResult[];
  tasks: SearchResult[];
  integrations: SearchResult[];
  documents: SearchResult[];
  sprints: SearchResult[];
  playbooks: SearchResult[];
}

const SECTION_CONFIG = {
  requirements: { label: "Requirements", Icon: File06 },
  skills: { label: "Skills", Icon: BookOpen01 },
  risks: { label: "Risks", Icon: AlertTriangle },
  users: { label: "People", Icon: User01 },
  tasks: { label: "Tasks", Icon: CheckSquare },
  integrations: { label: "Integrations", Icon: Link01 },
  documents: { label: "Documents", Icon: FileAttachment01 },
  sprints: { label: "Sprints", Icon: Calendar },
  playbooks: { label: "Playbooks", Icon: ClipboardCheck },
} as const;

const SEARCH_SECTION_KEYS = Object.keys(SECTION_CONFIG) as Array<keyof typeof SECTION_CONFIG>;

function hasAnyResults(results: SearchResults | undefined) {
  if (!results) return false;
  return SEARCH_SECTION_KEYS.some((key) => results[key].length > 0);
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const orgId = organization?.id;
  const results = useQuery(
    "search:globalSearch" as any,
    isAuthenticated && orgId && debouncedQuery.length >= 2
      ? { orgId, query: debouncedQuery }
      : "skip",
  ) as SearchResults | undefined;

  const hasResults = hasAnyResults(results);

  function handleSelect(href: string) {
    router.push(href);
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === backdropRef.current) onClose();
  }

  const content = (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh] backdrop-blur-sm"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-surface-default shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border-default px-4">
          <SearchMd size={20} className="shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search requirements, skills, risks, tasks, documents..."
            className="w-full bg-transparent py-3.5 text-sm text-text-heading outline-none placeholder:text-text-muted"
          />
          <kbd className="shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 text-xs text-text-muted">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {!isAuthenticated ? (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">
              Sign in to use search.
            </div>
          ) : (
            !orgId && (
              <div className="px-4 py-8 text-center text-sm text-text-secondary">
                Select an organization to search
              </div>
            )
          )}

          {isAuthenticated && orgId && debouncedQuery.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">
              Start typing to search...
            </div>
          )}

          {isAuthenticated && orgId && debouncedQuery.length >= 2 && results === undefined && (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">Searching...</div>
          )}

          {isAuthenticated && orgId && debouncedQuery.length >= 2 && results && !hasResults && (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">
              No results found for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {hasResults &&
            SEARCH_SECTION_KEYS.map((key) => {
              const activeResults = results as SearchResults;
              const items = activeResults[key];
              if (items.length === 0) return null;

              const { label, Icon } = SECTION_CONFIG[key];

              return (
                <div key={key}>
                  <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {label}
                  </div>

                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-interactive-hover"
                    >
                      <Icon size={16} className="shrink-0 text-text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-heading">
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-text-secondary">{item.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
