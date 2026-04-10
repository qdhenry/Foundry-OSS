// @ts-nocheck
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * Code health signal computation from source control data.
 *
 * Computes 8 signals from sourceControlPullRequests, sourceControlCommits,
 * and related tables. All thresholds are hard-coded V1 defaults.
 */

// ---------------------------------------------------------------------------
// Constants — V1 hard-coded thresholds
// ---------------------------------------------------------------------------

const VELOCITY_DECLINE_THRESHOLD = 0.5; // < 50% of rolling avg
const LARGE_LATE_COMMIT_LOC = 500; // > 500 LOC
const SPRINT_LATE_WINDOW = 0.2; // final 20% of sprint
const ABANDONED_BRANCH_DAYS = 5; // no commits for 5 days
const SINGLE_AUTHOR_THRESHOLD = 0.7; // > 70% from one author
const PR_REVIEW_TURNAROUND_MS = 48 * 60 * 60 * 1000; // 48 hours
const CI_FAILURE_RATE_THRESHOLD = 0.3; // > 30% failing
const FILES_CHANGED_THRESHOLD = 25; // > 25 files per PR

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * MS_PER_DAY;

// ---------------------------------------------------------------------------
// Signal types
// ---------------------------------------------------------------------------

export interface CodeHealthSignal {
  name: string;
  value: number; // 0-100 (100 = healthy)
  severity: "healthy" | "warning" | "critical";
  detail: string;
}

export interface CodeHealthResult {
  compositeScore: number; // 0-100
  signals: CodeHealthSignal[];
  commitVelocityScore: number;
  prReviewTurnaroundScore: number;
  ciPassRateScore: number;
  warningScore: number;
}

// ---------------------------------------------------------------------------
// computeCodeHealth — compute code health signals for a workstream
// ---------------------------------------------------------------------------

export const computeCodeHealth = query({
  args: {
    workstreamId: v.id("workstreams"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<CodeHealthResult> => {
    const now = Date.now();

    // Get repos linked to this program
    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (repos.length === 0) {
      return emptyHealthResult();
    }

    const repoIds = repos.map((r) => r._id);

    // Get tasks for this workstream to scope commits/PRs
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();
    const taskIds = new Set(tasks.map((t) => t._id));

    // Get active sprint for timing context
    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();
    const activeSprint = sprints.find((s) => s.status === "active");

    // Collect all commits and PRs across repos
    const allCommits: Doc<"sourceControlCommits">[] = [];
    const allPRs: Doc<"sourceControlPullRequests">[] = [];
    for (const repoId of repoIds) {
      const commits = await ctx.db
        .query("sourceControlCommits")
        .withIndex("by_repo_date", (q) => q.eq("repositoryId", repoId))
        .collect();
      allCommits.push(...commits);

      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_repo", (q) => q.eq("repositoryId", repoId))
        .collect();
      allPRs.push(...prs);
    }

    // Filter to workstream-relevant items (linked to workstream tasks)
    const wsCommits = allCommits.filter((c) => c.taskId && taskIds.has(c.taskId));
    const wsPRs = allPRs.filter((p) => p.taskId && taskIds.has(p.taskId));

    // Use all commits for repo-wide signals (velocity, force pushes, author concentration)
    const recentCommits = allCommits.filter((c) => c.committedAt > now - SEVEN_DAYS_MS * 2);

    const signals: CodeHealthSignal[] = [];

    // 1. Commit velocity declining
    const velocitySignal = computeCommitVelocity(recentCommits, now);
    signals.push(velocitySignal);

    // 2. Large late commits
    const lateCommitSignal = computeLargeLateCom(wsCommits, activeSprint, now);
    signals.push(lateCommitSignal);

    // 3. Abandoned branches
    const abandonedSignal = computeAbandonedBranches(wsPRs, now);
    signals.push(abandonedSignal);

    // 4. Force pushes to main
    const forcePushSignal = computeForcePushes(ctx, repos, now);
    signals.push(await forcePushSignal);

    // 5. Single-author concentration
    const authorSignal = computeAuthorConcentration(recentCommits);
    signals.push(authorSignal);

    // 6. PR review turnaround
    const turnaroundSignal = computePRReviewTurnaround(wsPRs, now);
    signals.push(turnaroundSignal);

    // 7. CI failure rate
    const ciSignal = computeCIFailureRate(wsPRs);
    signals.push(ciSignal);

    // 8. Files changed per PR
    const filesSignal = computeFilesChanged(wsPRs);
    signals.push(filesSignal);

    // Weighted composite: velocity(30%) + turnaround(25%) + CI(25%) + warnings(20%)
    const commitVelocityScore = velocitySignal.value;
    const prReviewTurnaroundScore = turnaroundSignal.value;
    const ciPassRateScore = ciSignal.value;

    // Warning score: average of non-primary signals
    const warningSignals = [lateCommitSignal, abandonedSignal, authorSignal, filesSignal];
    const fpSignal = signals.find((s) => s.name === "force_pushes");
    if (fpSignal) warningSignals.push(fpSignal);
    const warningScore =
      warningSignals.length > 0
        ? warningSignals.reduce((sum, s) => sum + s.value, 0) / warningSignals.length
        : 100;

    const compositeScore = Math.round(
      commitVelocityScore * 0.3 +
        prReviewTurnaroundScore * 0.25 +
        ciPassRateScore * 0.25 +
        warningScore * 0.2,
    );

    return {
      compositeScore,
      signals,
      commitVelocityScore,
      prReviewTurnaroundScore,
      ciPassRateScore,
      warningScore: Math.round(warningScore),
    };
  },
});

// ---------------------------------------------------------------------------
// getForProgram — program-level code health summary (public, auth-checked)
// ---------------------------------------------------------------------------

export const getForProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) return null;
    await assertOrgAccess(ctx, program.orgId);

    const now = Date.now();

    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (repos.length === 0) {
      return {
        compositeScore: 100,
        commitCount7d: 0,
        prsMerged7d: 0,
        prsAwaitingReview: 0,
        ciPassRate: 100,
        singleAuthorWarning: false,
        repoCount: 0,
      };
    }

    // Collect recent commits and PRs across all repos
    const allCommits: Doc<"sourceControlCommits">[] = [];
    const allPRs: Doc<"sourceControlPullRequests">[] = [];
    for (const repo of repos) {
      const commits = await ctx.db
        .query("sourceControlCommits")
        .withIndex("by_repo_date", (q) =>
          q.eq("repositoryId", repo._id).gte("committedAt", now - SEVEN_DAYS_MS),
        )
        .collect();
      allCommits.push(...commits);

      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
        .collect();
      allPRs.push(...prs);
    }

    const commitCount7d = allCommits.length;

    // PRs merged in last 7 days
    const prsMerged7d = allPRs.filter(
      (p) => p.state === "merged" && p.mergedAt && p.mergedAt > now - SEVEN_DAYS_MS,
    ).length;

    // Open PRs awaiting review (not draft, review state none or pending)
    const prsAwaitingReview = allPRs.filter(
      (p) =>
        p.state === "open" &&
        !p.isDraft &&
        (p.reviewState === "none" || p.reviewState === "pending"),
    ).length;

    // CI pass rate across open PRs with CI data
    const prsWithCI = allPRs.filter((p) => p.state === "open" && p.ciStatus !== "none");
    const ciPassing = prsWithCI.filter((p) => p.ciStatus === "passing").length;
    const ciPassRate =
      prsWithCI.length > 0 ? Math.round((ciPassing / prsWithCI.length) * 100) : 100;

    // Single author concentration warning
    let singleAuthorWarning = false;
    if (allCommits.length > 0) {
      const authorCounts = new Map<string, number>();
      for (const c of allCommits) {
        authorCounts.set(c.authorLogin, (authorCounts.get(c.authorLogin) ?? 0) + 1);
      }
      let maxCount = 0;
      for (const count of authorCounts.values()) {
        if (count > maxCount) maxCount = count;
      }
      singleAuthorWarning = maxCount / allCommits.length > SINGLE_AUTHOR_THRESHOLD;
    }

    // Composite: simple weighted average
    const velocitySignal = computeCommitVelocity(allCommits, now);
    const compositeScore = Math.round(
      velocitySignal.value * 0.3 +
        ciPassRate * 0.25 +
        (prsAwaitingReview === 0 ? 100 : Math.max(0, 100 - prsAwaitingReview * 15)) * 0.25 +
        (singleAuthorWarning ? 50 : 100) * 0.2,
    );

    return {
      compositeScore,
      commitCount7d,
      prsMerged7d,
      prsAwaitingReview,
      ciPassRate,
      singleAuthorWarning,
      repoCount: repos.length,
    };
  },
});

// ---------------------------------------------------------------------------
// Signal computation helpers
// ---------------------------------------------------------------------------

function computeCommitVelocity(
  recentCommits: Doc<"sourceControlCommits">[],
  now: number,
): CodeHealthSignal {
  const thisWeek = recentCommits.filter((c) => c.committedAt > now - SEVEN_DAYS_MS);
  const lastWeek = recentCommits.filter(
    (c) => c.committedAt > now - SEVEN_DAYS_MS * 2 && c.committedAt <= now - SEVEN_DAYS_MS,
  );

  if (lastWeek.length === 0) {
    return {
      name: "commit_velocity",
      value: 100,
      severity: "healthy",
      detail: "No prior week data for comparison",
    };
  }

  const ratio = thisWeek.length / lastWeek.length;
  const isDecline = ratio < VELOCITY_DECLINE_THRESHOLD;

  return {
    name: "commit_velocity",
    value: isDecline ? Math.round(ratio * 100) : 100,
    severity: isDecline ? "warning" : "healthy",
    detail: `${thisWeek.length} commits this week vs ${lastWeek.length} last week (${Math.round(ratio * 100)}%)`,
  };
}

function computeLargeLateCom(
  commits: Doc<"sourceControlCommits">[],
  sprint: Doc<"sprints"> | undefined,
  _now: number,
): CodeHealthSignal {
  if (!sprint?.startDate || !sprint.endDate) {
    return {
      name: "large_late_commits",
      value: 100,
      severity: "healthy",
      detail: "No active sprint with dates",
    };
  }

  const sprintDuration = sprint.endDate - sprint.startDate;
  const lateWindowStart = sprint.startDate + sprintDuration * (1 - SPRINT_LATE_WINDOW);
  const lateCommits = commits.filter(
    (c) => c.committedAt >= lateWindowStart && c.committedAt <= sprint.endDate!,
  );
  const largeLateCommits = lateCommits.filter(
    (c) => c.additions + c.deletions > LARGE_LATE_COMMIT_LOC,
  );

  const hasLargeLateCom = largeLateCommits.length > 0;
  return {
    name: "large_late_commits",
    value: hasLargeLateCom ? 50 : 100,
    severity: hasLargeLateCom ? "warning" : "healthy",
    detail: hasLargeLateCom
      ? `${largeLateCommits.length} commits with >${LARGE_LATE_COMMIT_LOC} LOC in final ${SPRINT_LATE_WINDOW * 100}% of sprint`
      : "No large late commits detected",
  };
}

function computeAbandonedBranches(
  prs: Doc<"sourceControlPullRequests">[],
  now: number,
): CodeHealthSignal {
  const openPRs = prs.filter((p) => p.state === "open");
  const abandonedPRs = openPRs.filter(
    (p) => now - p.updatedAt > ABANDONED_BRANCH_DAYS * MS_PER_DAY,
  );

  const hasAbandoned = abandonedPRs.length > 0;
  return {
    name: "abandoned_branches",
    value: hasAbandoned ? Math.max(0, 100 - abandonedPRs.length * 25) : 100,
    severity: hasAbandoned ? "warning" : "healthy",
    detail: hasAbandoned
      ? `${abandonedPRs.length} open PRs with no activity for >${ABANDONED_BRANCH_DAYS} days`
      : "No abandoned branches",
  };
}

async function computeForcePushes(
  ctx: QueryCtx,
  repos: Doc<"sourceControlRepositories">[],
  now: number,
): Promise<CodeHealthSignal> {
  // Check sourceControlEvents for force push events in the last 7 days
  let forcePushCount = 0;
  for (const repo of repos) {
    const events = await ctx.db
      .query("sourceControlEvents")
      .withIndex("by_entity", (q) =>
        q
          .eq("entityType", "push")
          .eq("entityId", `${repo.repoFullName}@refs/heads/${repo.defaultBranch}`),
      )
      .collect();
    const recentForced = events.filter(
      (e) =>
        e.receivedAt > now - SEVEN_DAYS_MS &&
        e.status === "processed" &&
        (e.payload as any)?.forced === true,
    );
    forcePushCount += recentForced.length;
  }

  return {
    name: "force_pushes",
    value: forcePushCount > 0 ? 0 : 100,
    severity: forcePushCount > 0 ? "critical" : "healthy",
    detail:
      forcePushCount > 0
        ? `${forcePushCount} force push(es) to default branch in last 7 days`
        : "No force pushes to default branch",
  };
}

function computeAuthorConcentration(commits: Doc<"sourceControlCommits">[]): CodeHealthSignal {
  if (commits.length === 0) {
    return {
      name: "single_author_concentration",
      value: 100,
      severity: "healthy",
      detail: "No commits to analyze",
    };
  }

  const authorCounts = new Map<string, number>();
  for (const c of commits) {
    authorCounts.set(c.authorLogin, (authorCounts.get(c.authorLogin) ?? 0) + 1);
  }

  let maxAuthor = "";
  let maxCount = 0;
  for (const [author, count] of authorCounts) {
    if (count > maxCount) {
      maxCount = count;
      maxAuthor = author;
    }
  }

  const concentration = maxCount / commits.length;
  const isConcentrated = concentration > SINGLE_AUTHOR_THRESHOLD;

  return {
    name: "single_author_concentration",
    value: isConcentrated ? Math.round((1 - concentration) * 200) : 100,
    severity: isConcentrated ? "warning" : "healthy",
    detail: `${maxAuthor} authored ${Math.round(concentration * 100)}% of commits (${maxCount}/${commits.length})`,
  };
}

function computePRReviewTurnaround(
  prs: Doc<"sourceControlPullRequests">[],
  now: number,
): CodeHealthSignal {
  // Look at PRs that have been reviewed (not "none")
  const reviewedPRs = prs.filter((p) => p.reviewState !== "none");
  if (reviewedPRs.length === 0) {
    // No reviewed PRs — check if there are pending ones
    const pendingReview = prs.filter(
      (p) => p.state === "open" && !p.isDraft && p.reviewState === "none",
    );
    if (pendingReview.length === 0) {
      return {
        name: "pr_review_turnaround",
        value: 100,
        severity: "healthy",
        detail: "No PRs awaiting review",
      };
    }
    // Estimate turnaround from open time of pending PRs
    const avgWait =
      pendingReview.reduce((sum, p) => sum + (now - p.createdAt), 0) / pendingReview.length;
    const isSlow = avgWait > PR_REVIEW_TURNAROUND_MS;
    return {
      name: "pr_review_turnaround",
      value: isSlow
        ? Math.max(0, Math.round(100 - (avgWait / PR_REVIEW_TURNAROUND_MS - 1) * 50))
        : 100,
      severity: isSlow ? "warning" : "healthy",
      detail: `${pendingReview.length} PRs awaiting review, avg wait ${Math.round(avgWait / (60 * 60 * 1000))}h`,
    };
  }

  // Estimate turnaround as time from creation to latest update (rough proxy)
  const turnarounds = reviewedPRs.map((p) => p.updatedAt - p.createdAt);
  const avgTurnaround = turnarounds.reduce((sum, t) => sum + t, 0) / turnarounds.length;
  const isSlow = avgTurnaround > PR_REVIEW_TURNAROUND_MS;

  return {
    name: "pr_review_turnaround",
    value: isSlow
      ? Math.max(0, Math.round(100 - (avgTurnaround / PR_REVIEW_TURNAROUND_MS - 1) * 50))
      : 100,
    severity: isSlow ? "warning" : "healthy",
    detail: `Average review turnaround: ${Math.round(avgTurnaround / (60 * 60 * 1000))}h`,
  };
}

function computeCIFailureRate(prs: Doc<"sourceControlPullRequests">[]): CodeHealthSignal {
  const prsWithCI = prs.filter((p) => p.ciStatus !== "none");
  if (prsWithCI.length === 0) {
    return {
      name: "ci_failure_rate",
      value: 100,
      severity: "healthy",
      detail: "No CI data available",
    };
  }

  const failing = prsWithCI.filter((p) => p.ciStatus === "failing").length;
  const failureRate = failing / prsWithCI.length;
  const isHigh = failureRate > CI_FAILURE_RATE_THRESHOLD;

  return {
    name: "ci_failure_rate",
    value: Math.round((1 - failureRate) * 100),
    severity: isHigh ? "warning" : "healthy",
    detail: `${failing}/${prsWithCI.length} PRs with failing CI (${Math.round(failureRate * 100)}%)`,
  };
}

function computeFilesChanged(prs: Doc<"sourceControlPullRequests">[]): CodeHealthSignal {
  const openPRs = prs.filter((p) => p.state === "open");
  if (openPRs.length === 0) {
    return {
      name: "files_changed_per_pr",
      value: 100,
      severity: "healthy",
      detail: "No open PRs to analyze",
    };
  }

  const largePRs = openPRs.filter((p) => p.filesChanged > FILES_CHANGED_THRESHOLD);
  const hasLarge = largePRs.length > 0;

  return {
    name: "files_changed_per_pr",
    value: hasLarge ? Math.max(0, 100 - largePRs.length * 25) : 100,
    severity: hasLarge ? "warning" : "healthy",
    detail: hasLarge
      ? `${largePRs.length} PR(s) with >${FILES_CHANGED_THRESHOLD} files changed`
      : "All PRs within file count threshold",
  };
}

// ---------------------------------------------------------------------------
// Empty result for programs with no repos
// ---------------------------------------------------------------------------

function emptyHealthResult(): CodeHealthResult {
  return {
    compositeScore: 100,
    signals: [],
    commitVelocityScore: 100,
    prReviewTurnaroundScore: 100,
    ciPassRateScore: 100,
    warningScore: 100,
  };
}
