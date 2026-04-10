// @ts-nocheck
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * Sprint gate code evidence assembly.
 *
 * Gathers code-based gate criteria for sprint gate evaluations:
 * PR merge completion, CI status, review coverage, force push count,
 * and deployment status per environment.
 *
 * The returned CodeEvidenceSummary is consumed by the sprint gate
 * evaluation action (convex/sprintGateEvaluationActions.ts).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeploymentEnvironmentStatus {
  environment: string;
  status: "pending" | "in_progress" | "success" | "failure" | "error" | "inactive";
  deployedAt: number | null;
  sha: string | null;
}

export interface CodeEvidenceSummary {
  /** Percentage of linked PRs that are merged (0-100) */
  prMergeCompletionPct: number;
  /** Total PRs linked to sprint tasks */
  totalPRs: number;
  /** Merged PRs */
  mergedPRs: number;
  /** Open PRs still awaiting merge */
  openPRs: number;
  /** CI status for the default branch across repos */
  ciBranchStatus: "passing" | "failing" | "pending" | "none";
  /** Count of unresolved review comments across sprint PRs */
  unresolvedReviewComments: number;
  /** Code review coverage: PRs with migration reviews / total PRs (0-100) */
  reviewCoveragePct: number;
  /** Number of PRs with at least one migration review */
  reviewedPRCount: number;
  /** Force push count to default branches in sprint window */
  forcePushCount: number;
  /** Deployment status per normalized environment */
  deploymentStatus: DeploymentEnvironmentStatus[];
  /** Whether any DANGER/ROGUE requirements exist (from implementation completeness) */
  hasHighRiskRequirements: boolean;
  /** Sprint date range used for evidence window */
  evidenceWindow: {
    start: number | null;
    end: number | null;
  };
}

// ---------------------------------------------------------------------------
// assembleCodeEvidence — gather code evidence for a sprint gate evaluation
// ---------------------------------------------------------------------------

export const assembleCodeEvidence = query({
  args: {
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<CodeEvidenceSummary> => {
    // Load sprint for date range
    const sprint = await ctx.db.get(args.sprintId);
    const sprintStart = sprint?.startDate ?? null;
    const sprintEnd = sprint?.endDate ?? null;

    // Get workstream for scoping
    const _workstreamId = sprint?.workstreamId ?? null;

    // Get tasks in this sprint
    const sprintTasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
    const _taskIds = new Set(sprintTasks.map((t) => t._id));

    // Get repos for this program
    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Collect all PRs linked to sprint tasks
    const sprintPRs: Doc<"sourceControlPullRequests">[] = [];
    for (const task of sprintTasks) {
      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      sprintPRs.push(...prs);
    }

    // 1. PR merge completion
    const totalPRs = sprintPRs.length;
    const mergedPRs = sprintPRs.filter((p) => p.state === "merged").length;
    const openPRs = sprintPRs.filter((p) => p.state === "open").length;
    const prMergeCompletionPct = totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 100) : 0;

    // 2. CI status for default branch
    const ciBranchStatus = computeDefaultBranchCI(sprintPRs, repos);

    // 3. Unresolved review comments count
    const unresolvedReviewComments = await countUnresolvedReviews(ctx, sprintPRs);

    // 4. Code review coverage
    const reviewedPRCount = await countReviewedPRs(ctx, sprintPRs);
    const reviewCoveragePct = totalPRs > 0 ? Math.round((reviewedPRCount / totalPRs) * 100) : 0;

    // 5. Force push count in sprint window
    const forcePushCount = await countForcePushes(ctx, repos, sprintStart, sprintEnd);

    // 6. Deployment status per environment
    const deploymentStatus = await getDeploymentStatus(ctx, args.programId);

    // 7. High-risk requirements check (DANGER/ROGUE from implementation scores)
    const hasHighRiskRequirements = await checkHighRiskRequirements(
      ctx,
      sprintTasks,
      args.programId,
    );

    return {
      prMergeCompletionPct,
      totalPRs,
      mergedPRs,
      openPRs,
      ciBranchStatus,
      unresolvedReviewComments,
      reviewCoveragePct,
      reviewedPRCount,
      forcePushCount,
      deploymentStatus,
      hasHighRiskRequirements,
      evidenceWindow: {
        start: sprintStart,
        end: sprintEnd,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// getForSprint — auth-checked code evidence for a sprint (public)
// ---------------------------------------------------------------------------

export const getForSprint = query({
  args: {
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<CodeEvidenceSummary | null> => {
    const program = await ctx.db.get(args.programId);
    if (!program) return null;
    await assertOrgAccess(ctx, program.orgId);

    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) return null;

    const sprintStart = sprint.startDate ?? null;
    const sprintEnd = sprint.endDate ?? null;

    const sprintTasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const sprintPRs: Doc<"sourceControlPullRequests">[] = [];
    for (const task of sprintTasks) {
      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      sprintPRs.push(...prs);
    }

    const totalPRs = sprintPRs.length;
    const mergedPRs = sprintPRs.filter((p) => p.state === "merged").length;
    const openPRs = sprintPRs.filter((p) => p.state === "open").length;
    const prMergeCompletionPct = totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 100) : 0;

    const ciBranchStatus = computeDefaultBranchCI(sprintPRs, repos);
    const unresolvedReviewComments = await countUnresolvedReviews(ctx, sprintPRs);
    const reviewedPRCount = await countReviewedPRs(ctx, sprintPRs);
    const reviewCoveragePct = totalPRs > 0 ? Math.round((reviewedPRCount / totalPRs) * 100) : 0;
    const forcePushCount = await countForcePushes(ctx, repos, sprintStart, sprintEnd);
    const deploymentStatus = await getDeploymentStatus(ctx, args.programId);
    const hasHighRiskRequirements = await checkHighRiskRequirements(
      ctx,
      sprintTasks,
      args.programId,
    );

    return {
      prMergeCompletionPct,
      totalPRs,
      mergedPRs,
      openPRs,
      ciBranchStatus,
      unresolvedReviewComments,
      reviewCoveragePct,
      reviewedPRCount,
      forcePushCount,
      deploymentStatus,
      hasHighRiskRequirements,
      evidenceWindow: { start: sprintStart, end: sprintEnd },
    };
  },
});

// ---------------------------------------------------------------------------
// Helper: CI status for default branch
// ---------------------------------------------------------------------------

function computeDefaultBranchCI(
  prs: Doc<"sourceControlPullRequests">[],
  _repos: Doc<"sourceControlRepositories">[],
): "passing" | "failing" | "pending" | "none" {
  // Use the most recent merged PR's CI status as a proxy for default branch health
  const mergedPRs = prs
    .filter((p) => p.state === "merged" && p.ciStatus !== "none")
    .sort((a, b) => (b.mergedAt ?? 0) - (a.mergedAt ?? 0));

  if (mergedPRs.length > 0) {
    return mergedPRs[0].ciStatus as "passing" | "failing" | "pending";
  }

  // Fall back to any open PR CI status
  const openWithCI = prs.filter((p) => p.state === "open" && p.ciStatus !== "none");
  if (openWithCI.length > 0) {
    const hasFailure = openWithCI.some((p) => p.ciStatus === "failing");
    if (hasFailure) return "failing";
    const hasPending = openWithCI.some((p) => p.ciStatus === "pending");
    if (hasPending) return "pending";
    return "passing";
  }

  return "none";
}

// ---------------------------------------------------------------------------
// Helper: Count unresolved review comments
// ---------------------------------------------------------------------------

async function countUnresolvedReviews(
  _ctx: any,
  prs: Doc<"sourceControlPullRequests">[],
): Promise<number> {
  let count = 0;
  for (const pr of prs) {
    if (pr.state !== "merged" && pr.reviewState === "changes_requested") {
      // Each PR with changes_requested counts as having unresolved comments
      // Exact comment count would require GitHub API call; use PR count as proxy
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helper: Count PRs with migration reviews
// ---------------------------------------------------------------------------

async function countReviewedPRs(
  ctx: any,
  prs: Doc<"sourceControlPullRequests">[],
): Promise<number> {
  let reviewed = 0;
  for (const pr of prs) {
    const reviews = await ctx.db
      .query("sourceControlReviews")
      .withIndex("by_pr", (q: any) => q.eq("prId", pr._id))
      .collect();
    if (reviews.length > 0) {
      reviewed++;
    }
  }
  return reviewed;
}

// ---------------------------------------------------------------------------
// Helper: Count force pushes in sprint window
// ---------------------------------------------------------------------------

async function countForcePushes(
  ctx: any,
  repos: Doc<"sourceControlRepositories">[],
  sprintStart: number | null,
  sprintEnd: number | null,
): Promise<number> {
  let count = 0;
  const now = Date.now();
  const windowStart = sprintStart ?? now - 14 * 24 * 60 * 60 * 1000; // fallback: 14 days
  const windowEnd = sprintEnd ?? now;

  for (const repo of repos) {
    const events = await ctx.db
      .query("sourceControlEvents")
      .withIndex("by_entity", (q: any) =>
        q
          .eq("entityType", "push")
          .eq("entityId", `${repo.repoFullName}@refs/heads/${repo.defaultBranch}`),
      )
      .collect();

    const forcePushes = events.filter(
      (e: any) =>
        e.receivedAt >= windowStart &&
        e.receivedAt <= windowEnd &&
        e.status === "processed" &&
        (e.payload as any)?.forced === true,
    );
    count += forcePushes.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helper: Deployment status per environment
// ---------------------------------------------------------------------------

async function getDeploymentStatus(
  ctx: any,
  programId: Id<"programs">,
): Promise<DeploymentEnvironmentStatus[]> {
  const environments = ["development", "staging", "qa", "production"];
  const results: DeploymentEnvironmentStatus[] = [];

  for (const env of environments) {
    const deployments = await ctx.db
      .query("sourceControlDeployments")
      .withIndex("by_program_env", (q: any) => q.eq("programId", programId).eq("environment", env))
      .collect();

    if (deployments.length === 0) {
      results.push({
        environment: env,
        status: "inactive",
        deployedAt: null,
        sha: null,
      });
      continue;
    }

    // Get the most recent deployment
    const latest = deployments.sort((a: any, b: any) => b.deployedAt - a.deployedAt)[0];

    results.push({
      environment: env,
      status: latest.status,
      deployedAt: latest.deployedAt,
      sha: latest.sha,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helper: Check for high-risk requirements (DANGER/ROGUE)
// ---------------------------------------------------------------------------

async function checkHighRiskRequirements(
  ctx: any,
  sprintTasks: Doc<"tasks">[],
  programId: Id<"programs">,
): Promise<boolean> {
  // Get unique requirement IDs from sprint tasks
  const reqIds = new Set<Id<"requirements">>();
  for (const task of sprintTasks) {
    if (task.requirementId) {
      reqIds.add(task.requirementId);
    }
  }

  // Check if any requirements have very low scope completeness but high implementation
  // This is a simplified check — full readiness matrix is in completeness/readinessMatrix.ts
  for (const reqId of reqIds) {
    const req = await ctx.db.get(reqId);
    if (!req) continue;

    // Simplified scope check: requirements still in "draft" with linked PRs
    // are potential DANGER/ROGUE candidates
    if (req.status === "draft" && !req.description) {
      // Check if there are any PRs linked to this requirement's tasks
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
      const reqTasks = tasks.filter((t: any) => t.requirementId === reqId);

      for (const task of reqTasks) {
        const prs = await ctx.db
          .query("sourceControlPullRequests")
          .withIndex("by_task", (q: any) => q.eq("taskId", task._id))
          .collect();
        if (prs.length > 0) {
          return true; // Building without spec = high risk
        }
      }
    }
  }

  return false;
}
