import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

// ---------------------------------------------------------------------------
// 1. getDailyDigest — query (reactive, checks cache first)
// ---------------------------------------------------------------------------
export const getDailyDigest = query({
  args: {
    programId: v.id("programs"),
    lastVisitTime: v.number(),
  },
  handler: async (ctx, args) => {
    // Auth: get program, verify identity + org access
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Check cache via by_program_user index
    const cached = await ctx.db
      .query("dailyDigestCache")
      .withIndex("by_program_user", (q) =>
        q.eq("programId", args.programId).eq("userId", identity.subject),
      )
      .first();

    if (cached && cached.expiresAt > Date.now()) {
      return {
        digest: cached.digest,
        source: "cache" as const,
        metadata: cached.metadata,
      };
    }

    // No valid cache — fetch recent context for the action to consume
    const auditLogs = await ctx.db
      .query("auditLog")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .filter((q) => q.gte(q.field("timestamp"), args.lastVisitTime))
      .take(100);

    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const risks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Build summary context
    const changesSummary = auditLogs.map((log) => ({
      action: log.action,
      entityType: log.entityType,
      description: log.description,
      userName: log.userName,
      timestamp: log.timestamp,
    }));

    const workstreamSummary = workstreams.map((ws) => ({
      name: ws.name,
      shortCode: ws.shortCode,
      status: ws.status,
    }));

    const taskSummary = {
      total: tasks.length,
      byStatus: {
        backlog: tasks.filter((t) => t.status === "backlog").length,
        todo: tasks.filter((t) => t.status === "todo").length,
        in_progress: tasks.filter((t) => t.status === "in_progress").length,
        review: tasks.filter((t) => t.status === "review").length,
        done: tasks.filter((t) => t.status === "done").length,
      },
      blocked: tasks.filter((t) => t.blockedBy && t.blockedBy.length > 0).length,
    };

    const requirementSummary = {
      total: requirements.length,
      byStatus: {
        draft: requirements.filter((r) => r.status === "draft").length,
        approved: requirements.filter((r) => r.status === "approved").length,
        in_progress: requirements.filter((r) => r.status === "in_progress").length,
        complete: requirements.filter((r) => r.status === "complete").length,
        deferred: requirements.filter((r) => r.status === "deferred").length,
      },
    };

    const riskSummary = {
      total: risks.length,
      critical: risks.filter((r) => r.severity === "critical").length,
      high: risks.filter((r) => r.severity === "high").length,
      open: risks.filter((r) => r.status === "open").length,
    };

    return {
      digest: null,
      source: "generate" as const,
      context: {
        orgId: program.orgId,
        programId: args.programId,
        userId: identity.subject,
        changesSummary,
        workstreamSummary,
        taskSummary,
        requirementSummary,
        riskSummary,
        lastVisitTime: args.lastVisitTime,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// 3. cacheDigest — internalMutation (called from generateDailyDigest action)
// ---------------------------------------------------------------------------
export const cacheDigest = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    userId: v.string(),
    digest: v.string(),
    metadata: v.object({
      auditLogsAnalyzed: v.number(),
      changeCount: v.number(),
      workstreamsAffected: v.number(),
      tokensUsed: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Delete existing cache entry for this program+user
    const existing = await ctx.db
      .query("dailyDigestCache")
      .withIndex("by_program_user", (q) =>
        q.eq("programId", args.programId).eq("userId", args.userId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Insert new cache with 24h TTL
    await ctx.db.insert("dailyDigestCache", {
      orgId: args.orgId,
      programId: args.programId,
      userId: args.userId,
      lastVisitTime: Date.now(),
      digest: args.digest,
      metadata: args.metadata,
      expiresAt: Date.now() + 86400000, // 24 hours
    });
  },
});
