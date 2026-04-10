// @ts-nocheck
"use node";

import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { getProvider } from "../factory";
import type { NormalizedPR } from "../types";

/**
 * Daily reconciliation action — Node.js runtime for GitHub API calls.
 *
 * Runs daily at 03:00 UTC (configured in convex/crons.ts).
 * For each active repo: fetches latest PRs from GitHub, compares with
 * platform state, auto-corrects drift silently, logs correction count.
 *
 * Throttled to max 100 API calls per run to stay within rate limits.
 */

const MAX_API_CALLS_PER_RUN = 100;

// ---------------------------------------------------------------------------
// runDailyReconciliation — scheduled entry point
// ---------------------------------------------------------------------------

export const runDailyReconciliation = internalAction({
  args: {},
  handler: async (ctx) => {
    const repos = await ctx.runQuery(
      internal.sourceControl.sync.reconciliation.getActiveRepositories,
    );

    let totalApiCalls = 0;
    let totalCorrections = 0;

    for (const repo of repos) {
      if (totalApiCalls >= MAX_API_CALLS_PER_RUN) {
        console.log(`[reconciliation] Hit API call limit (${MAX_API_CALLS_PER_RUN}), stopping`);
        break;
      }

      // Check installation is still active
      const installation = await ctx.runQuery(
        internal.sourceControl.sync.reconciliation.getRepoInstallation,
        { installationId: repo.installationId },
      );
      if (!installation || installation.status !== "active") {
        continue;
      }

      try {
        const provider = getProvider(repo.providerType);
        let corrections = 0;

        // Reconcile open PRs
        const platformPRs = await ctx.runQuery(
          internal.sourceControl.sync.reconciliation.getPRsByRepo,
          { repositoryId: repo._id },
        );

        // Fetch latest PRs from GitHub (page 1 — most recent)
        const token = await provider.getInstallationToken(repo.installationId);
        totalApiCalls++;

        // Use provider to get recent PRs
        // We'll fetch via the provider's commit history endpoint
        // and reconcile PR states
        const githubPRs = await fetchRecentPRs(token.token, repo.repoFullName);
        totalApiCalls++;

        // Compare and correct
        for (const ghPR of githubPRs) {
          const platformPR = platformPRs.find((p) => p.prNumber === ghPR.number);

          if (!platformPR) {
            // PR exists in GitHub but not in platform — create it
            await ctx.runMutation(
              internal.sourceControl.sync.reconciliation.upsertPRFromReconciliation,
              {
                orgId: repo.orgId,
                repositoryId: repo._id,
                prNumber: ghPR.number,
                title: ghPR.title,
                body: ghPR.body ?? undefined,
                state: ghPR.state,
                isDraft: ghPR.isDraft,
                authorLogin: ghPR.authorLogin,
                sourceBranch: ghPR.sourceBranch,
                targetBranch: ghPR.targetBranch,
                reviewState: ghPR.reviewState,
                ciStatus: ghPR.ciStatus,
                commitCount: ghPR.commitCount,
                filesChanged: ghPR.filesChanged,
                additions: ghPR.additions,
                deletions: ghPR.deletions,
                createdAt: ghPR.createdAt,
                updatedAt: ghPR.updatedAt,
                mergedAt: ghPR.mergedAt ?? undefined,
                providerUrl: ghPR.providerUrl,
              },
            );
            corrections++;
          } else if (
            platformPR.state !== ghPR.state ||
            platformPR.reviewState !== ghPR.reviewState ||
            platformPR.isDraft !== ghPR.isDraft
          ) {
            // State mismatch — correct
            await ctx.runMutation(
              internal.sourceControl.sync.reconciliation.upsertPRFromReconciliation,
              {
                orgId: repo.orgId,
                repositoryId: repo._id,
                prNumber: ghPR.number,
                title: ghPR.title,
                body: ghPR.body ?? undefined,
                state: ghPR.state,
                isDraft: ghPR.isDraft,
                authorLogin: ghPR.authorLogin,
                sourceBranch: ghPR.sourceBranch,
                targetBranch: ghPR.targetBranch,
                reviewState: ghPR.reviewState,
                ciStatus: ghPR.ciStatus,
                commitCount: ghPR.commitCount,
                filesChanged: ghPR.filesChanged,
                additions: ghPR.additions,
                deletions: ghPR.deletions,
                createdAt: ghPR.createdAt,
                updatedAt: ghPR.updatedAt,
                mergedAt: ghPR.mergedAt ?? undefined,
                providerUrl: ghPR.providerUrl,
              },
            );
            corrections++;
          }
        }

        totalCorrections += corrections;

        // Update reconciliation result
        await ctx.runMutation(
          internal.sourceControl.sync.reconciliation.updateReconciliationResult,
          {
            repositoryId: repo._id,
            orgId: repo.orgId,
            correctionsCount: corrections,
          },
        );

        console.log(`[reconciliation] ${repo.repoFullName}: ${corrections} corrections`);
      } catch (error) {
        console.error(
          `[reconciliation] Failed for ${repo.repoFullName}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(
      `[reconciliation] Complete: ${repos.length} repos, ${totalApiCalls} API calls, ${totalCorrections} corrections`,
    );
  },
});

// ---------------------------------------------------------------------------
// fetchRecentPRs — fetch PRs from GitHub REST API
// ---------------------------------------------------------------------------

async function fetchRecentPRs(token: string, repoFullName: string): Promise<NormalizedPR[]> {
  const url = `https://api.github.com/repos/${repoFullName}/pulls?state=all&sort=updated&direction=desc&per_page=30`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const prs: any[] = await response.json();
  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.merged_at ? "merged" : (pr.state as "open" | "closed"),
    isDraft: pr.draft ?? false,
    authorLogin: pr.user?.login ?? "unknown",
    sourceBranch: pr.head?.ref ?? "",
    targetBranch: pr.base?.ref ?? "",
    reviewState: "none" as const,
    ciStatus: "none" as const,
    commitCount: pr.commits ?? 0,
    filesChanged: pr.changed_files ?? 0,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    createdAt: new Date(pr.created_at).getTime(),
    updatedAt: new Date(pr.updated_at).getTime(),
    mergedAt: pr.merged_at ? new Date(pr.merged_at).getTime() : null,
    providerUrl: pr.html_url ?? "",
  }));
}
