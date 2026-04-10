import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ── Internal Queries ────────────────────────────────────────────────

export const getAllWorkstreamsForScoring = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneWeekAgo = now - ONE_WEEK_MS;
    const twoWeeksAgo = now - 2 * ONE_WEEK_MS;

    // Get all workstreams for the program
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (workstreams.length === 0) return [];

    // Fetch program-level data once
    const allRequirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const allRisks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Enrich each workstream
    const enriched = await Promise.all(
      workstreams.map(async (ws) => {
        // Requirements by workstream
        const wsRequirements = allRequirements.filter((r) => r.workstreamId === ws._id);
        const requirementCounts = {
          total: wsRequirements.length,
          complete: wsRequirements.filter((r) => r.status === "complete").length,
          in_progress: wsRequirements.filter((r) => r.status === "in_progress").length,
          draft: wsRequirements.filter((r) => r.status === "draft").length,
          approved: wsRequirements.filter((r) => r.status === "approved").length,
          deferred: wsRequirements.filter((r) => r.status === "deferred").length,
        };

        // Tasks by workstream
        const wsTasks = allTasks.filter((t) => t.workstreamId === ws._id);
        const overdueTasks = wsTasks.filter(
          (t) => t.dueDate && t.dueDate < now && t.status !== "done",
        );
        const blockedTasks = wsTasks.filter(
          (t) => t.blockedBy && t.blockedBy.length > 0 && t.status !== "done",
        );
        const unassignedTasks = wsTasks.filter((t) => !t.assigneeId);
        const taskCounts = {
          total: wsTasks.length,
          done: wsTasks.filter((t) => t.status === "done").length,
          in_progress: wsTasks.filter((t) => t.status === "in_progress").length,
          overdue: overdueTasks.length,
          blocked: blockedTasks.length,
          unassigned: unassignedTasks.length,
        };

        // Risks affecting this workstream
        const wsRisks = allRisks.filter((r) => r.workstreamIds?.includes(ws._id));
        const riskCounts = {
          total: wsRisks.length,
          open: wsRisks.filter((r) => r.status === "open" || r.status === "mitigating").length,
          critical: wsRisks.filter((r) => r.severity === "critical").length,
          high: wsRisks.filter((r) => r.severity === "high").length,
        };

        // Dependencies as source
        const dependencies = await ctx.db
          .query("workstreamDependencies")
          .withIndex("by_source", (q) => q.eq("sourceWorkstreamId", ws._id))
          .collect();
        const dependencyCounts = {
          total: dependencies.length,
          blocked: dependencies.filter((d) => d.status === "blocked").length,
          active: dependencies.filter((d) => d.status === "active").length,
          resolved: dependencies.filter((d) => d.status === "resolved").length,
        };

        // Velocity: compare completions this week vs last week
        const completedThisWeek = wsTasks.filter(
          (t) => t.status === "done" && t._creationTime >= oneWeekAgo,
        ).length;
        const completedLastWeek = wsTasks.filter(
          (t) =>
            t.status === "done" && t._creationTime >= twoWeeksAgo && t._creationTime < oneWeekAgo,
        ).length;

        // Average task aging in days (for non-done tasks)
        const activeTasks = wsTasks.filter((t) => t.status !== "done");
        const avgTaskAgingDays =
          activeTasks.length > 0
            ? activeTasks.reduce(
                (sum, t) => sum + (now - t._creationTime) / (1000 * 60 * 60 * 24),
                0,
              ) / activeTasks.length
            : 0;

        // Sprint gates for this workstream
        const gates = await ctx.db
          .query("sprintGates")
          .withIndex("by_workstream", (q) => q.eq("workstreamId", ws._id))
          .collect();
        const gateCounts = {
          total: gates.length,
          passed: gates.filter((g) => g.status === "passed").length,
          failed: gates.filter((g) => g.status === "failed").length,
        };

        // Previous health score
        const previousScore = await ctx.db
          .query("aiHealthScores")
          .withIndex("by_workstream", (q) => q.eq("workstreamId", ws._id))
          .order("desc")
          .first();

        return {
          _id: ws._id,
          name: ws.name,
          shortCode: ws.shortCode,
          currentStatus: ws.status,
          previousHealth: previousScore?.health ?? null,
          previousHealthScore: previousScore?.healthScore ?? null,
          requirementCounts,
          taskCounts,
          riskCounts,
          dependencyCounts,
          velocity: {
            completedThisWeek,
            completedLastWeek,
            trend:
              completedLastWeek === 0
                ? completedThisWeek > 0
                  ? "improving"
                  : "stable"
                : completedThisWeek > completedLastWeek
                  ? "improving"
                  : completedThisWeek < completedLastWeek
                    ? "declining"
                    : "stable",
          },
          avgTaskAgingDays: Math.round(avgTaskAgingDays * 10) / 10,
          gateCounts,
        };
      }),
    );

    return enriched;
  },
});

// ── Internal Mutation: Store Health Score ────────────────────────────

export const storeHealthScore = internalMutation({
  args: {
    orgId: v.string(),
    workstreamId: v.id("workstreams"),
    health: v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("blocked")),
    healthScore: v.number(),
    reasoning: v.string(),
    factors: v.object({
      velocityScore: v.number(),
      taskAgingScore: v.number(),
      riskScore: v.number(),
      gatePassRate: v.number(),
      dependencyScore: v.number(),
    }),
    previousHealth: v.optional(
      v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("blocked")),
    ),
    changeReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Insert health score record
    await ctx.db.insert("aiHealthScores", {
      orgId: args.orgId,
      workstreamId: args.workstreamId,
      health: args.health,
      healthScore: args.healthScore,
      reasoning: args.reasoning,
      factors: args.factors,
      previousHealth: args.previousHealth,
      changeReason: args.changeReason,
      scheduledAt: now,
      expiresAt: now + ONE_WEEK_MS,
    });

    // If health changed from previous, update the workstream status
    if (args.previousHealth && args.health !== args.previousHealth) {
      await ctx.db.patch(args.workstreamId, {
        status: args.health,
        healthLastUpdated: now,
      });
    } else {
      // Always update healthLastUpdated
      await ctx.db.patch(args.workstreamId, {
        healthLastUpdated: now,
      });
    }
  },
});

// ── Public Queries ──────────────────────────────────────────────────

export const getLatestHealthScore = query({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    const latest = await ctx.db
      .query("aiHealthScores")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .order("desc")
      .first();

    return latest ?? null;
  },
});

export const getHealthHistory = query({
  args: {
    workstreamId: v.id("workstreams"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    const limit = args.limit ?? 10;

    const scores = await ctx.db
      .query("aiHealthScores")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .order("desc")
      .take(limit);

    return scores;
  },
});
