// @ts-nocheck
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Internal queries for PR detection — used by prDetectionActions.ts (Node.js action).
 */

// ---------------------------------------------------------------------------
// getDeploymentById
// ---------------------------------------------------------------------------

export const getDeploymentById = internalQuery({
  args: { deploymentId: v.id("sourceControlDeployments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.deploymentId);
  },
});

// ---------------------------------------------------------------------------
// getCommitBySha
// ---------------------------------------------------------------------------

export const getCommitBySha = internalQuery({
  args: { sha: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlCommits")
      .withIndex("by_sha", (q) => q.eq("sha", args.sha))
      .first();
  },
});

// ---------------------------------------------------------------------------
// getPRById
// ---------------------------------------------------------------------------

export const getPRById = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.prId);
  },
});
