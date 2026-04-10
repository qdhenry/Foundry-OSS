"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import type { AvailableRepo, ConnectedRepo } from "./types";

export interface UseRepoListOptions {
  programId: string | undefined;
  installationId: string | undefined;
  orgId: string | undefined;
}

export interface UseRepoListResult {
  connectedRepos: ConnectedRepo[];
  unconnectedRepos: AvailableRepo[];
  isLoadingConnected: boolean;
  isLoadingAvailable: boolean;
  availableError: string | null;
  refetchAvailable: () => void;
}

export function useRepoList({
  programId,
  installationId,
  orgId,
}: UseRepoListOptions): UseRepoListResult {
  const connectedResult = useQuery(
    "sourceControl/repositories:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const listAvailableRepos = useAction(
    "sourceControl/listAvailableRepos:listAvailableRepos" as any,
  );

  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);
  const [availableError, setAvailableError] = useState<string | null>(null);

  async function fetchAvailable() {
    if (!installationId || !orgId) return;
    setIsLoadingAvailable(true);
    setAvailableError(null);
    try {
      const result = await listAvailableRepos({ installationId, orgId });
      setAvailableRepos(result ?? []);
    } catch (e: any) {
      setAvailableError(e?.message ?? "Failed to load repositories.");
    } finally {
      setIsLoadingAvailable(false);
    }
  }

  useEffect(() => {
    if (installationId && orgId) {
      fetchAvailable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, orgId]);

  const connectedRepos: ConnectedRepo[] = (connectedResult ?? []) as ConnectedRepo[];
  const isLoadingConnected = connectedResult === undefined;

  // Filter out repos that are already connected to this program
  const connectedFullNames = new Set(connectedRepos.map((r) => r.repoFullName));
  const unconnectedRepos = availableRepos.filter((r) => !connectedFullNames.has(r.full_name));

  return {
    connectedRepos,
    unconnectedRepos,
    isLoadingConnected,
    isLoadingAvailable,
    availableError,
    refetchAvailable: fetchAvailable,
  };
}
