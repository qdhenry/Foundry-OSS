import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

// ── Event type validator (shared) ────────────────────────────────────────────
const eventTypeValidator = v.union(
  v.literal("sandbox_started"),
  v.literal("sandbox_completed"),
  v.literal("sandbox_failed"),
  v.literal("sandbox_cancelled"),
  v.literal("review_accepted"),
  v.literal("review_rejected"),
  v.literal("review_revised"),
  v.literal("subtask_started"),
  v.literal("subtask_completed"),
  v.literal("subtask_failed"),
  v.literal("subtask_retried"),
);

// ── Internal mutation — called from orchestrator actions ─────────────────────
export const record = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    taskId: v.id("tasks"),
    sandboxSessionId: v.optional(v.id("sandboxSessions")),
    agentExecutionId: v.optional(v.id("agentExecutions")),
    eventType: eventTypeValidator,
    initiatedBy: v.id("users"),
    initiatedByName: v.string(),
    initiatedByClerkId: v.string(),
    timestamp: v.number(),
    executionStartedAt: v.optional(v.number()),
    executionCompletedAt: v.optional(v.number()),
    taskTitle: v.string(),
    taskPrompt: v.optional(v.string()),
    skillId: v.optional(v.id("skills")),
    skillName: v.optional(v.string()),
    workstreamId: v.optional(v.id("workstreams")),
    environment: v.object({
      sandboxId: v.optional(v.string()),
      worktreeBranch: v.optional(v.string()),
      repositoryId: v.optional(v.id("sourceControlRepositories")),
      executionMode: v.optional(v.string()),
    }),
    outcome: v.object({
      status: v.string(),
      prUrl: v.optional(v.string()),
      prNumber: v.optional(v.number()),
      commitSha: v.optional(v.string()),
      filesChanged: v.optional(v.number()),
      tokensUsed: v.optional(v.number()),
      durationMs: v.optional(v.number()),
      error: v.optional(v.string()),
    }),
    reviewStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("revised"),
        v.literal("rejected"),
      ),
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("executionAuditRecords", args);
  },
});

// ── Queries ──────────────────────────────────────────────────────────────────

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    return await ctx.db
      .query("executionAuditRecords")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
  },
});

export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    eventType: v.optional(eventTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const limit = args.limit ?? 50;

    if (args.eventType) {
      return await ctx.db
        .query("executionAuditRecords")
        .withIndex("by_event_type", (q) =>
          q.eq("orgId", program.orgId).eq("eventType", args.eventType!),
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("executionAuditRecords")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(limit);
  },
});

export const listBySession = query({
  args: { sandboxSessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sandboxSessionId);
    if (!session) throw new ConvexError("Session not found");
    await assertOrgAccess(ctx, session.orgId);

    return await ctx.db
      .query("executionAuditRecords")
      .withIndex("by_session", (q) => q.eq("sandboxSessionId", args.sandboxSessionId))
      .order("desc")
      .collect();
  },
});
