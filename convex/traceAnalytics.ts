import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

// ---------------------------------------------------------------------------
// getTraceStats — aggregate execution metrics for a program within a date range
// ---------------------------------------------------------------------------
export const getTraceStats = query({
  args: {
    programId: v.id("programs"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate ?? now;

    // Fetch executions via program index
    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .collect();

    // Filter by date range in memory (program index doesn't include timestamp)
    const filtered = executions.filter(
      (e) => e._creationTime >= startDate && e._creationTime <= endDate,
    );

    // Aggregate
    let totalTokens = 0;
    let totalDurationMs = 0;
    let durationCount = 0;
    let acceptedCount = 0;
    let reviewedCount = 0;

    const byTrigger: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byReviewStatus: Record<string, number> = {};

    for (const exec of filtered) {
      if (exec.tokensUsed) totalTokens += exec.tokensUsed;
      if (exec.durationMs) {
        totalDurationMs += exec.durationMs;
        durationCount++;
      }

      const trigger = exec.trigger ?? "manual";
      byTrigger[trigger] = (byTrigger[trigger] ?? 0) + 1;

      if (exec.modelId) {
        byModel[exec.modelId] = (byModel[exec.modelId] ?? 0) + 1;
      }

      const status = exec.reviewStatus ?? "pending";
      byReviewStatus[status] = (byReviewStatus[status] ?? 0) + 1;

      if (status === "accepted" || status === "revised" || status === "rejected") {
        reviewedCount++;
        if (status === "accepted") acceptedCount++;
      }
    }

    // Get cost data from aiUsageRecords for the same period
    const usageRecords = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_program_recorded", (q) =>
        q.eq("programId", args.programId).gte("recordedAt", startDate).lte("recordedAt", endDate),
      )
      .collect();

    let totalCostUsd = 0;
    let totalCacheReadTokens = 0;
    let totalInputTokens = 0;

    for (const record of usageRecords) {
      totalCostUsd += record.costUsd;
      totalCacheReadTokens += record.cacheReadTokens;
      totalInputTokens += record.inputTokens;
    }

    const cacheEligible = totalInputTokens + totalCacheReadTokens;
    const cacheHitRate = cacheEligible > 0 ? totalCacheReadTokens / cacheEligible : 0;

    return {
      totalExecutions: filtered.length,
      totalTokens,
      totalCostUsd,
      avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
      cacheHitRate,
      acceptanceRate: reviewedCount > 0 ? acceptedCount / reviewedCount : 0,
      byTrigger,
      byModel,
      byReviewStatus,
    };
  },
});

// ---------------------------------------------------------------------------
// getTraceTimeline — daily execution volume + cost for sparkline charts
// ---------------------------------------------------------------------------
export const getTraceTimeline = query({
  args: {
    programId: v.id("programs"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const days = args.days ?? 14;
    const now = Date.now();
    const startDate = now - days * 24 * 60 * 60 * 1000;

    // Get usage records for cost timeline
    const usageRecords = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_program_recorded", (q) =>
        q.eq("programId", args.programId).gte("recordedAt", startDate).lte("recordedAt", now),
      )
      .collect();

    // Get executions for volume timeline
    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .collect();

    const filteredExec = executions.filter(
      (e) => e._creationTime >= startDate && e._creationTime <= now,
    );

    // Build day map
    const dayMap: Record<
      string,
      {
        costUsd: number;
        executions: number;
        totalDuration: number;
        durationCount: number;
      }
    > = {};

    for (const record of usageRecords) {
      const date = new Date(record.recordedAt);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { costUsd: 0, executions: 0, totalDuration: 0, durationCount: 0 };
      }
      dayMap[dayKey].costUsd += record.costUsd;
    }

    for (const exec of filteredExec) {
      const date = new Date(exec._creationTime);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { costUsd: 0, executions: 0, totalDuration: 0, durationCount: 0 };
      }
      dayMap[dayKey].executions++;
      if (exec.durationMs) {
        dayMap[dayKey].totalDuration += exec.durationMs;
        dayMap[dayKey].durationCount++;
      }
    }

    // Build sorted timeline with missing days filled
    const timeline: Array<{
      date: string;
      costUsd: number;
      executions: number;
      avgDurationMs: number;
    }> = [];

    for (let d = 0; d < days; d++) {
      const ts = startDate + d * 24 * 60 * 60 * 1000;
      const date = new Date(ts);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

      const entry = dayMap[dayKey];
      timeline.push({
        date: dayKey,
        costUsd: entry?.costUsd ?? 0,
        executions: entry?.executions ?? 0,
        avgDurationMs:
          entry && entry.durationCount > 0
            ? Math.round(entry.totalDuration / entry.durationCount)
            : 0,
      });
    }

    return timeline;
  },
});

// ---------------------------------------------------------------------------
// getExecutionDetail — single execution with full cost breakdown + audit events
// ---------------------------------------------------------------------------
export const getExecutionDetail = query({
  args: {
    executionId: v.id("agentExecutions"),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new ConvexError("Execution not found");

    const program = await ctx.db.get(execution.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // Resolve related entities
    let skillName: string | null = null;
    if (execution.skillId) {
      const skill = await ctx.db.get(execution.skillId);
      skillName = skill?.name ?? null;
    }

    let taskTitle: string | null = null;
    if (execution.taskId) {
      const task = await ctx.db.get(execution.taskId);
      taskTitle = task?.title ?? null;
    }

    let userName: string | null = null;
    if (execution.userId) {
      const user = await ctx.db.get(execution.userId);
      userName = user?.name ?? null;
    }

    // Get cost breakdown from aiUsageRecords
    const usageRecords = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_source_entity", (q) => q.eq("sourceEntityId", args.executionId as string))
      .collect();

    const costBreakdown =
      usageRecords.length > 0
        ? {
            inputTokens: usageRecords.reduce((sum, r) => sum + r.inputTokens, 0),
            outputTokens: usageRecords.reduce((sum, r) => sum + r.outputTokens, 0),
            cacheReadTokens: usageRecords.reduce((sum, r) => sum + r.cacheReadTokens, 0),
            cacheCreationTokens: usageRecords.reduce((sum, r) => sum + r.cacheCreationTokens, 0),
            costUsd: usageRecords.reduce((sum, r) => sum + r.costUsd, 0),
            modelId: usageRecords[0].claudeModelId,
          }
        : null;

    // Get audit events
    const auditEvents = await ctx.db
      .query("executionAuditRecords")
      .withIndex("by_agent_execution", (q) => q.eq("agentExecutionId", args.executionId))
      .order("desc")
      .collect();

    return {
      ...execution,
      skillName,
      taskTitle,
      userName,
      costBreakdown,
      auditEvents,
    };
  },
});
