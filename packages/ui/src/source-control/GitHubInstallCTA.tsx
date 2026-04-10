"use client";

import { GithubIcon } from "./icons";
import { useGitHubInstallation } from "./useGitHubInstallation";

interface GitHubInstallCTAProps {
  /** Contextual message fragment, e.g. "manage task repos" or "launch sandboxes" */
  purpose: string;
}

export function GitHubInstallCTA({ purpose }: GitHubInstallCTAProps) {
  const { activeInstallation, isSuspended, isLoading, installUrl } = useGitHubInstallation();

  // Hide while loading or when already connected
  if (isLoading || activeInstallation) {
    return null;
  }

  // Suspended state — warn the user
  if (isSuspended) {
    return (
      <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-4">
        <div className="flex items-start gap-3">
          <GithubIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-fg" />
          <div>
            <p className="text-sm font-medium text-status-warning-fg">
              GitHub App installation is suspended
            </p>
            <p className="mt-1 text-xs text-status-warning-fg">
              Re-enable the Foundry GitHub App in your GitHub organization settings to {purpose}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not installed — show install CTA
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated">
          <GithubIcon className="h-4 w-4 text-text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-heading">Connect GitHub to {purpose}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Install the Foundry GitHub App to enable repository access for your organization.
          </p>
        </div>
        <div className="shrink-0">
          {installUrl ? (
            <a
              href={installUrl}
              className="rounded-lg bg-accent-default px-3.5 py-1.5 text-sm font-medium text-text-on-brand hover:bg-accent-strong"
            >
              Install GitHub App
            </a>
          ) : (
            <p className="text-xs text-text-muted">
              Set{" "}
              <code className="rounded bg-surface-elevated px-1">NEXT_PUBLIC_GITHUB_APP_SLUG</code>{" "}
              to enable installation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
