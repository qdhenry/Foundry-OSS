import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

/** List all version snapshots for a skill, newest first. */
export const listBySkill = query({
  args: { skillId: v.id("skills") },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    await assertOrgAccess(ctx, skill.orgId);

    const versions = await ctx.db
      .query("skillVersions")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .collect();

    // Newest first (reverse creation order)
    versions.reverse();

    return versions;
  },
});

/** Retrieve a single skill version snapshot by ID. */
export const get = query({
  args: { versionId: v.id("skillVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new ConvexError("Version not found");
    await assertOrgAccess(ctx, version.orgId);

    return version;
  },
});

/**
 * Return two skill version snapshots side-by-side for comparison.
 * Both versions must belong to the same skill.
 * @param versionAId - First version
 * @param versionBId - Second version
 */
export const compare = query({
  args: {
    versionAId: v.id("skillVersions"),
    versionBId: v.id("skillVersions"),
  },
  handler: async (ctx, args) => {
    const versionA = await ctx.db.get(args.versionAId);
    if (!versionA) throw new ConvexError("Version A not found");
    await assertOrgAccess(ctx, versionA.orgId);

    const versionB = await ctx.db.get(args.versionBId);
    if (!versionB) throw new ConvexError("Version B not found");

    if (versionA.skillId !== versionB.skillId) {
      throw new ConvexError("Versions must belong to the same skill");
    }

    return { versionA, versionB };
  },
});
