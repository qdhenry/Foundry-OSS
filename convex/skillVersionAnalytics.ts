import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

// ---------------------------------------------------------------------------
// getVersionPerformance — per-version execution metrics for a skill
// ---------------------------------------------------------------------------
export const getVersionPerformance = query({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");

    const program = await ctx.db.get(skill.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // Get all versions ordered by creation time
    const versions = await ctx.db
      .query("skillVersions")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .order("asc")
      .collect();

    if (versions.length === 0) return [];

    // Get all executions for this skill
    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .order("asc")
      .collect();

    // Attribute each execution to a version by time window
    // Version N is active from its _creationTime until version N+1's _creationTime
    return versions.map((version, idx) => {
      const versionStart = version._creationTime;
      const versionEnd =
        idx < versions.length - 1 ? versions[idx + 1]._creationTime : Number.MAX_SAFE_INTEGER;

      const versionExecs = executions.filter(
        (e) => e._creationTime >= versionStart && e._creationTime < versionEnd,
      );

      const totalTokens = versionExecs.reduce((sum, e) => sum + (e.tokensUsed ?? 0), 0);
      const totalDuration = versionExecs.reduce((sum, e) => sum + (e.durationMs ?? 0), 0);
      const durationCount = versionExecs.filter((e) => e.durationMs).length;
      const reviewed = versionExecs.filter((e) => e.reviewStatus !== "pending");
      const accepted = reviewed.filter((e) => e.reviewStatus === "accepted");

      return {
        versionId: version._id,
        version: version.version,
        message: version.message ?? null,
        createdAt: version._creationTime,
        lineCount: version.lineCount,
        executionCount: versionExecs.length,
        avgTokens: versionExecs.length > 0 ? Math.round(totalTokens / versionExecs.length) : 0,
        avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
        acceptanceRate: reviewed.length > 0 ? accepted.length / reviewed.length : 0,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// getVersionContent — get content of two versions for diff comparison
// ---------------------------------------------------------------------------
export const getVersionContent = query({
  args: {
    versionIdA: v.id("skillVersions"),
    versionIdB: v.id("skillVersions"),
  },
  handler: async (ctx, args) => {
    const versionA = await ctx.db.get(args.versionIdA);
    const versionB = await ctx.db.get(args.versionIdB);
    if (!versionA || !versionB) throw new ConvexError("Version not found");

    // Auth check via skill -> program
    const skill = await ctx.db.get(versionA.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    const program = await ctx.db.get(skill.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return {
      a: {
        version: versionA.version,
        content: versionA.content,
        lineCount: versionA.lineCount,
      },
      b: {
        version: versionB.version,
        content: versionB.content,
        lineCount: versionB.lineCount,
      },
    };
  },
});
