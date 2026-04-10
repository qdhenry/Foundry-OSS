"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { useEffect, useState } from "react";

type RepoRole =
  | "storefront"
  | "integration"
  | "data_migration"
  | "infrastructure"
  | "extension"
  | "documentation";

const ROLE_OPTIONS: Array<{ value: RepoRole; label: string }> = [
  { value: "storefront", label: "Storefront" },
  { value: "integration", label: "Integration" },
  { value: "data_migration", label: "Data Migration" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "extension", label: "Extension" },
  { value: "documentation", label: "Documentation" },
];

interface AvailableRepo {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  language: string | null;
  private: boolean;
}

interface ConnectRepositoryInlineProps {
  programId: GenericId<"programs">;
}

function readGithubAppSlug(): string | undefined {
  const staticValue = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (typeof staticValue === "string" && staticValue.trim().length > 0) {
    return staticValue.trim();
  }
  const runtimeGlobal = globalThis as { process?: { env?: Record<string, unknown> } };
  const env = runtimeGlobal.process?.env;
  if (!env || typeof env !== "object") return undefined;
  const value = env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function ConnectRepositoryInline({ programId }: ConnectRepositoryInlineProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const installations = useQuery(
    "sourceControl/installations:listByOrg" as any,
    orgId ? { orgId } : "skip",
  );

  const listAvailableRepos = useAction(
    "sourceControl/listAvailableRepos:listAvailableRepos" as any,
  );
  const connectRepo = useMutation("sourceControl/repositories:connectRepository" as any);
  const claimInstallation = useMutation("sourceControl/installations:claimInstallation" as any);

  const [repos, setRepos] = useState<AvailableRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<AvailableRepo | null>(null);
  const [selectedRole, setSelectedRole] = useState<RepoRole>("storefront");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Auto-claim installation when redirected back from GitHub with installation_id
  useEffect(() => {
    if (!orgId || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const installId = params.get("github_installation_id");
    if (!installId) return;

    // Claim the installation, then clean up the URL
    claimInstallation({ installationId: installId, orgId }).then(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("github_installation_id");
      url.searchParams.delete("github_setup_action");
      window.history.replaceState({}, "", url.pathname);
    });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeInstallation = installations?.find((i: any) => i.status === "active") ?? null;
  const suspendedInstallation =
    !activeInstallation && installations?.some((i: any) => i.status === "suspended");

  async function fetchRepos() {
    if (!activeInstallation || !orgId) return;
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const result = await listAvailableRepos({
        installationId: activeInstallation.installationId,
        orgId,
      });
      setRepos(result ?? []);
    } catch (e: any) {
      setRepoError(e?.message ?? "Failed to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    if (activeInstallation) {
      fetchRepos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInstallation?.installationId]);

  async function handleConnect() {
    if (!selectedRepo || !activeInstallation) return;
    setConnecting(true);
    setConnectError(null);
    try {
      await connectRepo({
        programId,
        installationId: activeInstallation.installationId,
        repoFullName: selectedRepo.full_name,
        providerRepoId: String(selectedRepo.id),
        defaultBranch: selectedRepo.default_branch,
        language: selectedRepo.language ?? undefined,
        role: selectedRole,
        isMonorepo: false,
      });
      // Success — Convex reactivity updates the parent panel automatically.
    } catch (e: any) {
      setConnectError(e?.data ?? e?.message ?? "Failed to connect repository.");
      setConnecting(false);
    }
  }

  // Loading installations
  if (installations === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <PanelHeader />
        <div className="mt-4 flex items-center justify-center py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-default border-t-transparent" />
          <span className="ml-2 text-sm text-text-secondary">Checking GitHub connection...</span>
        </div>
      </div>
    );
  }

  // Installation suspended
  if (suspendedInstallation) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <PanelHeader />
        <div className="mt-4 rounded-lg border border-status-warning-border bg-status-warning-bg p-4">
          <p className="text-sm font-medium text-status-warning-fg">
            GitHub App installation is suspended
          </p>
          <p className="mt-1 text-xs text-status-warning-fg">
            Re-enable the Foundry GitHub App in your GitHub organization settings to connect
            repositories.
          </p>
        </div>
      </div>
    );
  }

  // No GitHub App installed
  if (!activeInstallation) {
    const githubAppSlug = readGithubAppSlug();
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <PanelHeader />
        <div className="mt-4 rounded-lg border border-border-default bg-surface-raised p-5 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated">
            <GithubIcon className="h-5 w-5 text-text-secondary" />
          </div>
          <p className="text-sm font-medium text-text-heading">Connect a GitHub repository</p>
          <p className="mt-1 text-xs text-text-secondary">
            Install the Foundry GitHub App to connect repositories to this program.
          </p>
          {githubAppSlug ? (
            <a
              href={`https://github.com/apps/${githubAppSlug}/installations/new?state=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
            >
              <GithubIcon className="h-4 w-4" />
              Install GitHub App
            </a>
          ) : (
            <p className="mt-3 text-xs text-text-muted">
              Set{" "}
              <code className="rounded bg-surface-elevated px-1">NEXT_PUBLIC_GITHUB_APP_SLUG</code>{" "}
              to enable GitHub App installation.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Repo loading state
  if (loadingRepos) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <PanelHeader />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-raised" />
          ))}
        </div>
      </div>
    );
  }

  // Repo fetch error
  if (repoError) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <PanelHeader />
        <div className="mt-4 rounded-lg border border-status-error-border bg-status-error-bg p-4">
          <p className="text-sm font-medium text-status-error-fg">Failed to load repositories</p>
          <p className="mt-1 text-xs text-status-error-fg">{repoError}</p>
          <button
            onClick={fetchRepos}
            className="mt-3 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // All repos already connected
  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <PanelHeader />
        <div className="mt-4 rounded-lg border border-border-default bg-surface-raised p-4 text-center">
          <p className="text-sm text-text-secondary">
            All available repositories are already connected to this program.
          </p>
        </div>
      </div>
    );
  }

  const filteredRepos = searchQuery
    ? repos.filter((r) => r.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : repos;

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      <PanelHeader />

      <div className="mt-4 space-y-3">
        {/* Search input */}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
          />
        </div>

        {/* Repo list */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border-default">
          {filteredRepos.length === 0 ? (
            <div className="py-4 text-center text-sm text-text-muted">No repositories match.</div>
          ) : (
            filteredRepos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => setSelectedRepo(selectedRepo?.id === repo.id ? null : repo)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-interactive-hover ${
                  selectedRepo?.id === repo.id ? "bg-status-info-bg" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <RepoIcon className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="truncate text-sm font-medium text-text-primary">
                    {repo.full_name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {repo.language && (
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
                      {repo.language}
                    </span>
                  )}
                  {repo.private && (
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
                      Private
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Role selector */}
        <div className="flex items-center gap-3">
          <label className="shrink-0 text-sm font-medium text-text-secondary">Role</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as RepoRole)}
            className="flex-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Connect error */}
        {connectError && (
          <div className="rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2">
            <p className="text-xs text-status-error-fg">{connectError}</p>
          </div>
        )}

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={!selectedRepo || connecting}
          className="w-full rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {connecting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-on-brand border-t-transparent" />
              Connecting...
            </span>
          ) : selectedRepo ? (
            `Connect ${selectedRepo.name}`
          ) : (
            "Select a repository to connect"
          )}
        </button>
      </div>
    </div>
  );
}

function PanelHeader() {
  return (
    <div className="flex items-center gap-2">
      <RepoIcon className="h-5 w-5 text-text-muted" />
      <h2 className="text-lg font-semibold text-text-heading">Connect Repository</h2>
    </div>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function RepoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M12 11h4" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
