"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon, RepoIcon, SearchIcon } from "./icons";
import { inferRepoRole } from "./role-heuristics";
import type { AvailableRepo, ConnectedRepo } from "./types";
import { useGitHubInstallation } from "./useGitHubInstallation";
import { useRepoList } from "./useRepoList";

interface RepoPickerDropdownProps {
  programId: string;
  entityType?: "task" | "workstream" | "sandbox";
  entityId?: string;
  onSelect?: (repoId: string) => void;
  onCreateClick?: () => void;
  showCreateOption?: boolean;
  workstreamName?: string;
  taskTitle?: string;
  /** For cascade prompt: parent workstream ID when entityType is "task" */
  workstreamId?: string;
  /** For cascade prompt: parent workstream name */
  workstreamNameForCascade?: string;
}

export function RepoPickerDropdown({
  programId,
  entityType,
  entityId,
  onSelect,
  onCreateClick,
  showCreateOption = true,
  workstreamName,
  taskTitle,
  workstreamId,
  workstreamNameForCascade,
}: RepoPickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [cascadePrompt, setCascadePrompt] = useState<{
    repoId: string;
    repoFullName: string;
    workstreamId: string;
    workstreamName: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { orgId, activeInstallation, isLoading: installLoading } = useGitHubInstallation();

  const { connectedRepos, unconnectedRepos, isLoadingConnected, isLoadingAvailable } = useRepoList({
    programId,
    installationId: activeInstallation?.installationId,
    orgId,
  });

  const connectRepo = useMutation("sourceControl/repositories:connectRepository" as any);
  const linkToTask = useMutation("sourceControl/entityBindings:linkRepoToTask" as any);
  const linkToWorkstream = useMutation("sourceControl/entityBindings:linkRepoToWorkstream" as any);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Slight delay to ensure DOM is mounted
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const linkToEntity = useCallback(
    async (repoId: string) => {
      if (!entityType || !entityId) return;
      if (entityType === "task") {
        await linkToTask({ taskId: entityId as any, repositoryId: repoId as any });
      } else if (entityType === "workstream") {
        await linkToWorkstream({
          workstreamId: entityId as any,
          repositoryId: repoId as any,
        });
      }
      // "sandbox" entity type — no binding mutation, just calls onSelect
    },
    [entityType, entityId, linkToTask, linkToWorkstream],
  );

  const handleSelectConnected = useCallback(
    async (repo: ConnectedRepo) => {
      if (busy) return;
      setBusy(true);
      try {
        await linkToEntity(repo._id);
        if (entityType === "task" && workstreamId) {
          setCascadePrompt({
            repoId: repo._id,
            repoFullName: repo.repoFullName,
            workstreamId,
            workstreamName: workstreamNameForCascade ?? "this workstream",
          });
          onSelect?.(repo._id);
          return; // Don't close dropdown yet — show cascade prompt
        }
        onSelect?.(repo._id);
        setIsOpen(false);
        setSearch("");
      } catch {
        // Silently handle — mutation errors surface via Convex toast
      } finally {
        setBusy(false);
      }
    },
    [busy, linkToEntity, onSelect, entityType, workstreamId, workstreamNameForCascade],
  );

  const handleSelectAvailable = useCallback(
    async (repo: AvailableRepo) => {
      if (busy || !activeInstallation) return;
      setBusy(true);
      try {
        const inferredRole = inferRepoRole({
          entityType,
          workstreamName,
          taskTitle,
          repoLanguage: repo.language,
        });

        const newRepoId = await connectRepo({
          programId: programId as any,
          installationId: activeInstallation.installationId,
          repoFullName: repo.full_name,
          providerRepoId: String(repo.id),
          defaultBranch: repo.default_branch,
          language: repo.language ?? undefined,
          role: inferredRole,
          isMonorepo: false,
        });

        if (newRepoId) {
          await linkToEntity(newRepoId);
          if (entityType === "task" && workstreamId) {
            setCascadePrompt({
              repoId: newRepoId,
              repoFullName: repo.full_name,
              workstreamId,
              workstreamName: workstreamNameForCascade ?? "this workstream",
            });
            onSelect?.(newRepoId);
            return; // Don't close dropdown yet — show cascade prompt
          }
          onSelect?.(newRepoId);
        }
        setIsOpen(false);
        setSearch("");
      } catch {
        // Silently handle — mutation errors surface via Convex toast
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      activeInstallation,
      entityType,
      workstreamName,
      taskTitle,
      connectRepo,
      programId,
      linkToEntity,
      onSelect,
      workstreamId,
      workstreamNameForCascade,
    ],
  );

  // If no active installation, return null (GitHubInstallCTA handles this)
  if (!installLoading && !activeInstallation) {
    return null;
  }

  const isLoading = installLoading || isLoadingConnected || isLoadingAvailable;

  // Filter repos by search query (client-side)
  const lowerSearch = search.toLowerCase();
  const filteredConnected = search
    ? connectedRepos.filter((r) => r.repoFullName.toLowerCase().includes(lowerSearch))
    : connectedRepos;
  const filteredAvailable = search
    ? unconnectedRepos.filter((r) => r.full_name.toLowerCase().includes(lowerSearch))
    : unconnectedRepos;

  const repoCount = connectedRepos.length;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm hover:border-accent-default hover:bg-surface-raised"
      >
        <RepoIcon className="h-4 w-4 text-text-muted" />
        <span className="text-text-primary">
          {repoCount > 0 ? `${repoCount} repo${repoCount !== 1 ? "s" : ""}` : "Connect repository"}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-xl border border-border-default bg-surface-default shadow-lg">
          {/* Search input */}
          <div className="relative px-3 pt-3 w-fu">
            <SearchIcon className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-raised py-1.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
            />
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-default border-t-transparent" />
              <span className="text-sm text-text-secondary">Loading repos...</span>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto px-1 py-2">
              {/* Connected section */}
              {filteredConnected.length > 0 && (
                <div>
                  <div className="px-3 py-1.5">
                    <span className="type-caption text-text-muted">Connected</span>
                  </div>
                  {filteredConnected.map((repo) => (
                    <button
                      key={repo._id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleSelectConnected(repo)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-interactive-hover disabled:opacity-50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <RepoIcon className="h-4 w-4 shrink-0 text-text-muted" />
                        <span className="truncate text-sm text-text-primary">
                          {repo.repoFullName}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[0.68rem] font-medium text-text-secondary">
                        {repo.role.replace(/_/g, " ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Available section */}
              {filteredAvailable.length > 0 && (
                <div>
                  {filteredConnected.length > 0 && (
                    <div className="mx-3 my-1 border-t border-border-default" />
                  )}
                  <div className="px-3 py-1.5">
                    <span className="type-caption text-text-muted">Available</span>
                  </div>
                  {filteredAvailable.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleSelectAvailable(repo)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-interactive-hover disabled:opacity-50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <RepoIcon className="h-4 w-4 shrink-0 text-text-muted" />
                        <span className="truncate text-sm text-text-primary">{repo.full_name}</span>
                      </div>
                      {repo.language && (
                        <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[0.68rem] font-medium text-text-secondary">
                          {repo.language}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {filteredConnected.length === 0 && filteredAvailable.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-text-muted">
                  {search ? "No repositories match your search." : "No repositories available."}
                </div>
              )}
            </div>
          )}

          {/* Footer — Create Repository */}
          {showCreateOption && (
            <>
              <div className="mx-3 border-t border-border-default" />
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    onCreateClick?.();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-interactive-hover"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create Repository
                </button>
              </div>
            </>
          )}

          {/* Cascade prompt — also add to workstream? */}
          {cascadePrompt && (
            <div className="border-t border-border-default p-3">
              <p className="text-xs text-text-secondary">
                Also add{" "}
                <span className="font-medium text-text-primary">{cascadePrompt.repoFullName}</span>{" "}
                to{" "}
                <span className="font-medium text-text-primary">
                  {cascadePrompt.workstreamName}
                </span>
                ?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => {
                    await linkToWorkstream({
                      workstreamId: cascadePrompt.workstreamId as any,
                      repositoryId: cascadePrompt.repoId as any,
                    });
                    setCascadePrompt(null);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong"
                >
                  Yes
                </button>
                <button
                  onClick={() => {
                    setCascadePrompt(null);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChevronDownIcon — small inline icon for the trigger button
// ---------------------------------------------------------------------------

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
