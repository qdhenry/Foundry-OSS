// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { getProvider } from "../factory";

/**
 * Initial sync action — 90-day historical data pull.
 *
 * Triggered when a repo is first connected to a program.
 * Paginates through GitHub API for PRs and commits from the last 90 days.
 *
 * Target: < 5 minutes for repos with < 1,000 PRs.
 * Throttled to avoid rate limits.
 */

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100; // GitHub API max per_page
const THROTTLE_DELAY_MS = 200; // 200ms between API calls

// ---------------------------------------------------------------------------
// runInitialSync — fetch historical PRs and commits
// ---------------------------------------------------------------------------

export const runInitialSync = internalAction({
  args: { repositoryId: v.id("sourceControlRepositories") },
  handler: async (ctx, args) => {
    // 1. Load repository record
    const repo = await ctx.runQuery(internal.sourceControl.repositories.getByIdInternal, {
      repositoryId: args.repositoryId,
    });
    if (!repo) {
      console.error(`[initial-sync] Repository ${args.repositoryId} not found`);
      return;
    }

    const provider = getProvider(repo.providerType);
    const sinceDate = new Date(Date.now() - NINETY_DAYS_MS);
    const sinceISO = sinceDate.toISOString();

    console.log(`[initial-sync] Starting 90-day sync for ${repo.repoFullName} (since ${sinceISO})`);

    try {
      // 2. Get installation token
      const token = await provider.getInstallationToken(repo.installationId);

      // 3. Fetch PRs (paginated)
      let prPage = 1;
      let totalPRsStored = 0;
      let hasMorePRs = true;

      while (hasMorePRs) {
        const prs = await fetchPRsPage(token.token, repo.repoFullName, sinceISO, prPage);

        if (prs.length === 0) {
          hasMorePRs = false;
          break;
        }

        // Filter to PRs within 90-day window
        const recentPRs = prs.filter(
          (pr: any) => new Date(pr.updated_at).getTime() > sinceDate.getTime(),
        );

        for (const pr of recentPRs) {
          await ctx.runMutation(internal.sourceControl.sync.initialSync.storePullRequest, {
            orgId: repo.orgId,
            repositoryId: repo._id,
            prNumber: pr.number,
            title: pr.title,
            body: pr.body ?? undefined,
            state: pr.merged_at ? "merged" : (pr.state as "open" | "closed"),
            isDraft: pr.draft ?? false,
            authorLogin: pr.user?.login ?? "unknown",
            sourceBranch: pr.head?.ref ?? "",
            targetBranch: pr.base?.ref ?? "",
            commitCount: pr.commits ?? 0,
            filesChanged: pr.changed_files ?? 0,
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            createdAt: new Date(pr.created_at).getTime(),
            updatedAt: new Date(pr.updated_at).getTime(),
            mergedAt: pr.merged_at ? new Date(pr.merged_at).getTime() : undefined,
            providerUrl: pr.html_url ?? "",
          });
          totalPRsStored++;
        }

        // If we got fewer than page size or all were outside window, stop
        if (prs.length < PAGE_SIZE || recentPRs.length === 0) {
          hasMorePRs = false;
        } else {
          prPage++;
          await sleep(THROTTLE_DELAY_MS);
        }
      }

      console.log(`[initial-sync] ${repo.repoFullName}: stored ${totalPRsStored} PRs`);

      // 4. Fetch recent commits on default branch (paginated)
      let commitPage = 1;
      let totalCommitsStored = 0;
      let hasMoreCommits = true;

      while (hasMoreCommits) {
        const commits = await fetchCommitsPage(
          token.token,
          repo.repoFullName,
          repo.defaultBranch,
          sinceISO,
          commitPage,
        );

        if (commits.length === 0) {
          hasMoreCommits = false;
          break;
        }

        for (const commit of commits) {
          await ctx.runMutation(internal.sourceControl.sync.initialSync.storeCommit, {
            orgId: repo.orgId,
            repositoryId: repo._id,
            sha: commit.sha,
            authorLogin: commit.commit?.author?.name ?? commit.author?.login ?? "unknown",
            message: (commit.commit?.message ?? "").slice(0, 5000),
            filesChanged: commit.stats?.total ?? 0,
            additions: commit.stats?.additions ?? 0,
            deletions: commit.stats?.deletions ?? 0,
            committedAt: new Date(commit.commit?.author?.date ?? Date.now()).getTime(),
          });
          totalCommitsStored++;
        }

        if (commits.length < PAGE_SIZE) {
          hasMoreCommits = false;
        } else {
          commitPage++;
          await sleep(THROTTLE_DELAY_MS);
        }
      }

      console.log(`[initial-sync] ${repo.repoFullName}: stored ${totalCommitsStored} commits`);

      // 5. Mark sync as complete
      await ctx.runMutation(
        internal.sourceControl.sync.initialSync.updateSyncStateAfterInitialSync,
        { repositoryId: repo._id },
      );

      console.log(
        `[initial-sync] Complete for ${repo.repoFullName}: ${totalPRsStored} PRs, ${totalCommitsStored} commits`,
      );
    } catch (error) {
      console.error(
        `[initial-sync] Failed for ${repo.repoFullName}:`,
        error instanceof Error ? error.message : error,
      );
    }
  },
});

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function fetchPRsPage(
  token: string,
  repoFullName: string,
  _since: string,
  page: number,
): Promise<any[]> {
  const url =
    `https://api.github.com/repos/${repoFullName}/pulls` +
    `?state=all&sort=updated&direction=desc&per_page=${PAGE_SIZE}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new Error(`Rate limited. Retry-After: ${retryAfter ?? "unknown"}`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function fetchCommitsPage(
  token: string,
  repoFullName: string,
  branch: string,
  since: string,
  page: number,
): Promise<any[]> {
  const url =
    `https://api.github.com/repos/${repoFullName}/commits` +
    `?sha=${branch}&since=${since}&per_page=${PAGE_SIZE}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new Error(`Rate limited. Retry-After: ${retryAfter ?? "unknown"}`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
