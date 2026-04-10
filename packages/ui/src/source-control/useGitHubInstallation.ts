"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

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

export interface GitHubInstallationState {
  orgId: string | undefined;
  activeInstallation: any | null;
  isSuspended: boolean;
  isLoading: boolean;
  githubAppSlug: string | undefined;
  installUrl: string | undefined;
}

export function useGitHubInstallation(): GitHubInstallationState {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const installations = useQuery(
    "sourceControl/installations:listByOrg" as any,
    orgId ? { orgId } : "skip",
  );

  const claimInstallation = useMutation("sourceControl/installations:claimInstallation" as any);

  // Guard ensures the claim effect runs once even in React StrictMode.
  // Do NOT reset this ref in cleanup.
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!orgId || typeof window === "undefined") return;
    if (claimedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const installId = params.get("github_installation_id");
    if (!installId) return;

    claimedRef.current = true;

    claimInstallation({ installationId: installId, orgId }).then(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("github_installation_id");
      url.searchParams.delete("github_setup_action");
      window.history.replaceState({}, "", url.pathname);
    });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeInstallation = installations?.find((i: any) => i.status === "active") ?? null;

  const isSuspended =
    !activeInstallation && (installations?.some((i: any) => i.status === "suspended") ?? false);

  const isLoading = installations === undefined;

  const githubAppSlug = readGithubAppSlug();

  const installUrl =
    githubAppSlug && typeof window !== "undefined"
      ? `https://github.com/apps/${githubAppSlug}/installations/new?state=${encodeURIComponent(window.location.pathname)}`
      : undefined;

  return {
    orgId,
    activeInstallation,
    isSuspended,
    isLoading,
    githubAppSlug,
    installUrl,
  };
}
