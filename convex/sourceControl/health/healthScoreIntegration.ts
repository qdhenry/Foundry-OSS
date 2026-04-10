// @ts-nocheck
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { query } from "../../_generated/server";

/**
 * Integration of code health signals into the overall health score formula.
 *
 * Updated formula:
 *   overallHealth = requirementProgress * 0.25 + sprintAdherence * 0.25
 *     + riskExposure * 0.20 + codeHealth * 0.15 + teamVelocity * 0.15
 *
 * This query returns the code health component and the blended overall score
 * when an existing aiHealthScores record is available.
 */

// ---------------------------------------------------------------------------
// Weight constants for the overall health formula
// ---------------------------------------------------------------------------

const WEIGHT_REQUIREMENT_PROGRESS = 0.25;
const WEIGHT_SPRINT_ADHERENCE = 0.25;
const WEIGHT_RISK_EXPOSURE = 0.2;
const WEIGHT_CODE_HEALTH = 0.15;
const WEIGHT_TEAM_VELOCITY = 0.15;

// ---------------------------------------------------------------------------
// getHealthWithCodeSignals — enhanced health score including code signals
// ---------------------------------------------------------------------------

export const getHealthWithCodeSignals = query({
  args: {
    workstreamId: v.id("workstreams"),
  },
  handler: async (ctx, args) => {
    // Load the workstream to get program context
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) {
      return null;
    }

    // Load the latest AI health score for this workstream
    const latestHealthScore = await ctx.db
      .query("aiHealthScores")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .order("desc")
      .first();

    // Compute code health signals inline (same logic as computeCodeHealth)
    const codeHealthScore = await computeCodeHealthInline(
      ctx,
      workstream.programId,
      args.workstreamId,
    );

    if (!latestHealthScore) {
      // No existing health score — return code health only
      return {
        overallHealth: null,
        codeHealth: codeHealthScore,
        existingHealthScore: null,
        blendedScore: null,
        factors: null,
      };
    }

    // Extract existing factor scores from the aiHealthScores record
    const factors = latestHealthScore.factors;

    // Compute blended score with new code health weight
    // The existing healthScore was computed without code health.
    // Re-blend with the Phase 6 formula including code health.
    const blendedScore = Math.round(
      // Use existing factor scores as proxies for the formula components
      factors.velocityScore * WEIGHT_TEAM_VELOCITY * 100 +
        factors.gatePassRate * WEIGHT_SPRINT_ADHERENCE * 100 +
        (100 - factors.riskScore) * WEIGHT_RISK_EXPOSURE +
        factors.taskAgingScore * WEIGHT_REQUIREMENT_PROGRESS * 100 +
        codeHealthScore * WEIGHT_CODE_HEALTH,
    );

    return {
      overallHealth: latestHealthScore.health,
      codeHealth: codeHealthScore,
      existingHealthScore: latestHealthScore.healthScore,
      blendedScore: Math.min(100, Math.max(0, blendedScore)),
      factors: {
        requirementProgress: Math.round(factors.taskAgingScore * 100),
        sprintAdherence: Math.round(factors.gatePassRate * 100),
        riskExposure: Math.round((1 - factors.riskScore) * 100),
        codeHealth: codeHealthScore,
        teamVelocity: Math.round(factors.velocityScore * 100),
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Inline code health computation (avoids cross-query dependency)
// ---------------------------------------------------------------------------

async function computeCodeHealthInline(
  ctx: any,
  programId: any,
  workstreamId: any,
): Promise<number> {
  const repos = await ctx.db
    .query("sourceControlRepositories")
    .withIndex("by_program", (q: any) => q.eq("programId", programId))
    .collect();

  if (repos.length === 0) return 100;

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_workstream", (q: any) => q.eq("workstreamId", workstreamId))
    .collect();
  const taskIds = new Set(tasks.map((t: any) => t._id));

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const allCommits: Doc<"sourceControlCommits">[] = [];
  const allPRs: Doc<"sourceControlPullRequests">[] = [];

  for (const repo of repos) {
    const commits = await ctx.db
      .query("sourceControlCommits")
      .withIndex("by_repo_date", (q: any) => q.eq("repositoryId", repo._id))
      .collect();
    allCommits.push(...commits);

    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo", (q: any) => q.eq("repositoryId", repo._id))
      .collect();
    allPRs.push(...prs);
  }

  const wsPRs = allPRs.filter((p) => p.taskId && taskIds.has(p.taskId));
  const recentCommits = allCommits.filter((c) => c.committedAt > now - sevenDaysMs * 2);

  // Velocity score
  const thisWeek = recentCommits.filter((c) => c.committedAt > now - sevenDaysMs);
  const lastWeek = recentCommits.filter(
    (c) => c.committedAt > now - sevenDaysMs * 2 && c.committedAt <= now - sevenDaysMs,
  );
  const velocityRatio = lastWeek.length > 0 ? thisWeek.length / lastWeek.length : 1;
  const velocityScore = velocityRatio < 0.5 ? Math.round(velocityRatio * 100) : 100;

  // PR turnaround score
  const prsWithReview = wsPRs.filter((p) => p.reviewState !== "none");
  let turnaroundScore = 100;
  if (prsWithReview.length > 0) {
    const avgTurnaround =
      prsWithReview.reduce((sum, p) => sum + (p.updatedAt - p.createdAt), 0) / prsWithReview.length;
    const turnaroundMs = 48 * 60 * 60 * 1000;
    turnaroundScore =
      avgTurnaround > turnaroundMs
        ? Math.max(0, Math.round(100 - (avgTurnaround / turnaroundMs - 1) * 50))
        : 100;
  }

  // CI score
  const prsWithCI = wsPRs.filter((p) => p.ciStatus !== "none");
  let ciScore = 100;
  if (prsWithCI.length > 0) {
    const failing = prsWithCI.filter((p) => p.ciStatus === "failing").length;
    ciScore = Math.round((1 - failing / prsWithCI.length) * 100);
  }

  // Warning score (simplified)
  const openPRs = wsPRs.filter((p) => p.state === "open");
  const abandonedCount = openPRs.filter((p) => now - p.updatedAt > 5 * 24 * 60 * 60 * 1000).length;
  const largePRCount = openPRs.filter((p) => p.filesChanged > 25).length;
  const warningPenalty = (abandonedCount + largePRCount) * 10;
  const warningScore = Math.max(0, 100 - warningPenalty);

  return Math.round(
    velocityScore * 0.3 + turnaroundScore * 0.25 + ciScore * 0.25 + warningScore * 0.2,
  );
}
