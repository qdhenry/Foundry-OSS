// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { getProvider } from "../factory";

/**
 * Auto-detect PRs included in a deployment via SHA walking.
 *
 * When a deployment completes successfully, walks the commit history between
 * the previous deployment SHA and new SHA to find all PRs that shipped.
 * Also supports manual PR adjustments via the manualPRAdjustments field.
 */

// ---------------------------------------------------------------------------
// detectDeploymentPRs — auto-detect PRs in a deployment
// ---------------------------------------------------------------------------

export const detectDeploymentPRs = internalAction({
  args: {
    deploymentId: v.id("sourceControlDeployments"),
  },
  handler: async (ctx, args) => {
    // 1. Load the deployment by ID
    const deploymentData = await ctx.runQuery(
      internal.sourceControl.deployments.prDetection.getDeploymentById,
      { deploymentId: args.deploymentId },
    );

    if (!deploymentData) return;

    // 2. Get the repository
    const repo = await ctx.runQuery(internal.sourceControl.repositories.getByIdInternal, {
      repositoryId: deploymentData.repositoryId,
    });
    if (!repo) return;

    // 3. Find the previous successful deployment to the same environment
    const prevDeployment = await ctx.runQuery(
      internal.sourceControl.deployments.deploymentTracking.getPreviousSuccessfulDeployment,
      {
        repositoryId: deploymentData.repositoryId,
        environment: deploymentData.environment,
        beforeDeploymentId: args.deploymentId,
      },
    );

    if (!prevDeployment) {
      // No previous deployment — can't determine delta
      return;
    }

    // 4. Walk commit history between previous SHA and new SHA
    const provider = getProvider(repo.providerType);
    let commits;
    try {
      commits = await provider.getCommitsBetween(
        repo.providerRepoId,
        prevDeployment.sha,
        deploymentData.sha,
      );
    } catch {
      // GitHub API may fail if SHAs are too far apart or force-pushed
      return;
    }

    // 5. Map commits to PRs via stored sourceControlCommits
    const prNumbers = new Set<number>();
    const taskIds = new Set<string>();

    for (const commit of commits) {
      const storedCommit = await ctx.runQuery(
        internal.sourceControl.deployments.prDetection.getCommitBySha,
        { sha: commit.sha },
      );

      if (storedCommit?.prId) {
        const pr = await ctx.runQuery(internal.sourceControl.deployments.prDetection.getPRById, {
          prId: storedCommit.prId,
        });
        if (pr) {
          prNumbers.add(pr.prNumber);
          if (pr.taskId) {
            taskIds.add(pr.taskId);
          }
        }
      }
    }

    // 6. Store results on the deployment
    await ctx.runMutation(
      internal.sourceControl.deployments.deploymentTracking.updateDeploymentPRs,
      {
        deploymentId: args.deploymentId,
        relatedPRNumbers: Array.from(prNumbers),
        relatedTaskIds: Array.from(taskIds) as Id<"tasks">[],
      },
    );
  },
});
