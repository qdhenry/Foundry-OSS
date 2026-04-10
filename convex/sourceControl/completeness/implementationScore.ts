// @ts-nocheck
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";

/**
 * Implementation completeness scoring for requirements.
 *
 * Formula:
 *   implementationScore = codeExistence * 0.30 + prCompletion * 0.25
 *     + testCoverage * 0.20 + reviewCompletion * 0.15 + ciPassing * 0.10
 *
 * Each component scores 0-100. The weighted composite gives a 0-100 score.
 */

// ---------------------------------------------------------------------------
// Score component weights
// ---------------------------------------------------------------------------

const WEIGHT_CODE_EXISTENCE = 0.3;
const WEIGHT_PR_COMPLETION = 0.25;
const WEIGHT_TEST_COVERAGE = 0.2;
const WEIGHT_REVIEW_COMPLETION = 0.15;
const WEIGHT_CI_PASSING = 0.1;

// ---------------------------------------------------------------------------
// PR state scoring maps
// ---------------------------------------------------------------------------

const PR_STATE_SCORES: Record<string, number> = {
  merged: 100,
  approved: 80, // open + approved review
  open: 60,
  draft: 40,
};

const REVIEW_STATE_SCORES: Record<string, number> = {
  approved: 100,
  pending: 50,
  changes_requested: 25,
  none: 0,
};

const CI_STATUS_SCORES: Record<string, number> = {
  passing: 100,
  pending: 50,
  failing: 0,
  none: 0,
};

// ---------------------------------------------------------------------------
// Test file detection patterns
// ---------------------------------------------------------------------------

const TEST_FILE_PATTERNS = [/test/i, /spec/i, /__tests__/i, /\.test\./i, /\.spec\./i];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImplementationScoreResult {
  score: number; // 0-100 composite
  components: {
    codeExistence: number;
    prCompletion: number;
    testCoverage: number;
    reviewCompletion: number;
    ciPassing: number;
  };
  linkedPRCount: number;
  linkedTaskCount: number;
  bestPRState: string | null;
}

// ---------------------------------------------------------------------------
// computeImplementationScore — score a requirement's implementation completeness
// ---------------------------------------------------------------------------

export const computeImplementationScore = query({
  args: {
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args): Promise<ImplementationScoreResult> => {
    // Find all tasks linked to this requirement
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) {
      return emptyScore();
    }

    // Get tasks for this requirement (no direct index, scan by program)
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", requirement.programId))
      .collect();
    const reqTasks = allTasks.filter((t) => t.requirementId === args.requirementId);

    if (reqTasks.length === 0) {
      return emptyScore();
    }

    const taskIds = reqTasks.map((t) => t._id);

    // Find all PRs linked to these tasks
    const allPRs: Doc<"sourceControlPullRequests">[] = [];
    for (const taskId of taskIds) {
      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect();
      allPRs.push(...prs);
    }

    // 1. Code existence: any PR linked at all?
    const codeExistence = allPRs.length > 0 ? 100 : 0;

    // 2. PR completion: best PR state across all linked PRs
    let prCompletion = 0;
    let bestPRState: string | null = null;
    for (const pr of allPRs) {
      let score: number;
      if (pr.state === "merged") {
        score = PR_STATE_SCORES.merged;
      } else if (pr.state === "open" && pr.reviewState === "approved") {
        score = PR_STATE_SCORES.approved;
      } else if (pr.state === "open" && pr.isDraft) {
        score = PR_STATE_SCORES.draft;
      } else if (pr.state === "open") {
        score = PR_STATE_SCORES.open;
      } else {
        score = 0; // closed without merge
      }
      if (score > prCompletion) {
        prCompletion = score;
        bestPRState = pr.state === "merged" ? "merged" : pr.isDraft ? "draft" : pr.state;
      }
    }

    // 3. Test coverage: heuristic — check if any linked commits touch test files
    const testCoverage = await estimateTestCoverage(ctx, allPRs);

    // 4. Review completion: best review state across PRs
    let reviewCompletion = 0;
    for (const pr of allPRs) {
      const score = REVIEW_STATE_SCORES[pr.reviewState] ?? 0;
      if (score > reviewCompletion) reviewCompletion = score;
    }

    // 5. CI passing: best CI status across PRs
    let ciPassing = 0;
    for (const pr of allPRs) {
      const score = CI_STATUS_SCORES[pr.ciStatus] ?? 0;
      if (score > ciPassing) ciPassing = score;
    }

    const score = Math.round(
      codeExistence * WEIGHT_CODE_EXISTENCE +
        prCompletion * WEIGHT_PR_COMPLETION +
        testCoverage * WEIGHT_TEST_COVERAGE +
        reviewCompletion * WEIGHT_REVIEW_COMPLETION +
        ciPassing * WEIGHT_CI_PASSING,
    );

    return {
      score,
      components: {
        codeExistence,
        prCompletion,
        testCoverage,
        reviewCompletion,
        ciPassing,
      },
      linkedPRCount: allPRs.length,
      linkedTaskCount: reqTasks.length,
      bestPRState,
    };
  },
});

// ---------------------------------------------------------------------------
// computeImplementationScoreForRequirement — helper for readiness matrix
// ---------------------------------------------------------------------------

export async function computeScoreForRequirement(
  ctx: QueryCtx,
  requirementId: Id<"requirements">,
  programId: Id<"programs">,
): Promise<number> {
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_program", (q) => q.eq("programId", programId))
    .collect();
  const reqTasks = allTasks.filter((t) => t.requirementId === requirementId);

  if (reqTasks.length === 0) return 0;

  const taskIds = reqTasks.map((t) => t._id);
  const allPRs: Doc<"sourceControlPullRequests">[] = [];
  for (const taskId of taskIds) {
    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
    allPRs.push(...prs);
  }

  if (allPRs.length === 0) return 0;

  const codeExistence = 100;

  let prCompletion = 0;
  for (const pr of allPRs) {
    let score: number;
    if (pr.state === "merged") score = 100;
    else if (pr.state === "open" && pr.reviewState === "approved") score = 80;
    else if (pr.state === "open" && pr.isDraft) score = 40;
    else if (pr.state === "open") score = 60;
    else score = 0;
    if (score > prCompletion) prCompletion = score;
  }

  const testCoverage = await estimateTestCoverage(ctx, allPRs);

  let reviewCompletion = 0;
  for (const pr of allPRs) {
    const score = REVIEW_STATE_SCORES[pr.reviewState] ?? 0;
    if (score > reviewCompletion) reviewCompletion = score;
  }

  let ciPassing = 0;
  for (const pr of allPRs) {
    const score = CI_STATUS_SCORES[pr.ciStatus] ?? 0;
    if (score > ciPassing) ciPassing = score;
  }

  return Math.round(
    codeExistence * WEIGHT_CODE_EXISTENCE +
      prCompletion * WEIGHT_PR_COMPLETION +
      testCoverage * WEIGHT_TEST_COVERAGE +
      reviewCompletion * WEIGHT_REVIEW_COMPLETION +
      ciPassing * WEIGHT_CI_PASSING,
  );
}

// ---------------------------------------------------------------------------
// Test coverage estimation from commit data
// ---------------------------------------------------------------------------

async function estimateTestCoverage(
  ctx: QueryCtx,
  prs: Doc<"sourceControlPullRequests">[],
): Promise<number> {
  if (prs.length === 0) return 0;

  // Check commits for test-related file patterns
  for (const pr of prs) {
    const commits = await ctx.db
      .query("sourceControlCommits")
      .withIndex("by_pr", (q) => q.eq("prId", pr._id))
      .collect();

    for (const commit of commits) {
      // Heuristic: if commit message mentions test/spec, count as test coverage
      if (TEST_FILE_PATTERNS.some((p) => p.test(commit.message))) {
        return 100;
      }
    }
  }

  // No test evidence found — partial score if PRs are passing CI
  // (CI may include tests we can't see from metadata alone)
  const anyPassingCI = prs.some((p) => p.ciStatus === "passing");
  return anyPassingCI ? 50 : 0;
}

// ---------------------------------------------------------------------------
// Empty score
// ---------------------------------------------------------------------------

function emptyScore(): ImplementationScoreResult {
  return {
    score: 0,
    components: {
      codeExistence: 0,
      prCompletion: 0,
      testCoverage: 0,
      reviewCompletion: 0,
      ciPassing: 0,
    },
    linkedPRCount: 0,
    linkedTaskCount: 0,
    bestPRState: null,
  };
}
