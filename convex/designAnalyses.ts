import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

// ---------------------------------------------------------------------------
// Public queries for the design analysis UI.
// ---------------------------------------------------------------------------

// Get the latest analysis for a specific design asset
export const getByAsset = query({
  args: { designAssetId: v.id("designAssets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.designAssetId);
    if (!asset) return null;
    await assertOrgAccess(ctx, asset.orgId);

    const analyses = await ctx.db
      .query("designAnalyses")
      .withIndex("by_asset", (q) => q.eq("designAssetId", args.designAssetId))
      .collect();

    // Return the most recent analysis (last in creation order)
    return analyses[analyses.length - 1] ?? null;
  },
});

// List all analyses for a program
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) return [];
    await assertOrgAccess(ctx, program.orgId);

    return ctx.db
      .query("designAnalyses")
      .withIndex("by_program", (q) => q.eq("orgId", program.orgId).eq("programId", args.programId))
      .collect();
  },
});
