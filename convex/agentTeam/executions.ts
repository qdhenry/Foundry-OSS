import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

export const listByAgent = query({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);

    return await ctx.db
      .query("agentTaskExecutions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(50);
  },
});

export const listBySprintWorkflow = query({
  args: { sprintWorkflowId: v.id("sprintWorkflows") },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.sprintWorkflowId);
    if (!workflow) throw new Error("Workflow not found");
    await assertOrgAccess(ctx, workflow.orgId);

    return await ctx.db
      .query("agentTaskExecutions")
      .withIndex("by_sprint_workflow", (q) => q.eq("sprintWorkflowId", args.sprintWorkflowId))
      .collect();
  },
});

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("agentTaskExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    agentId: v.id("programAgents"),
    agentVersionId: v.id("agentVersions"),
    sprintWorkflowId: v.optional(v.id("sprintWorkflows")),
    taskId: v.optional(v.id("tasks")),
    executionMode: v.union(v.literal("sdk"), v.literal("sandbox")),
    inputSummary: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db.insert("agentTaskExecutions", {
      ...args,
      sandboxSessionId: undefined,
      status: "pending",
      outputSummary: undefined,
      tokensUsed: { input: 0, output: 0, total: 0 },
      durationMs: 0,
      cost: 0,
      errorDetails: undefined,
      retryCount: 0,
      reassignedTo: undefined,
    });
  },
});

export const updateStatus = mutation({
  args: {
    executionId: v.id("agentTaskExecutions"),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("retrying"),
      v.literal("reassigned"),
    ),
    outputSummary: v.optional(v.string()),
    tokensUsed: v.optional(v.object({ input: v.number(), output: v.number(), total: v.number() })),
    durationMs: v.optional(v.number()),
    cost: v.optional(v.number()),
    errorDetails: v.optional(v.string()),
    sandboxSessionId: v.optional(v.id("sandboxSessions")),
    reassignedTo: v.optional(v.id("programAgents")),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new Error("Execution not found");
    await assertOrgAccess(ctx, execution.orgId);

    const { executionId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );

    if (args.status === "retrying") {
      filtered.retryCount = execution.retryCount + 1;
    }

    await ctx.db.patch(executionId, filtered);
  },
});

// Internal versions for workflow/orchestration context (no auth check)
export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    agentId: v.id("programAgents"),
    agentVersionId: v.id("agentVersions"),
    orchestrationRunId: v.optional(v.id("orchestrationRuns")),
    taskId: v.optional(v.id("tasks")),
    executionMode: v.union(v.literal("sdk"), v.literal("sandbox")),
    inputSummary: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentTaskExecutions", {
      ...args,
      sprintWorkflowId: undefined,
      sandboxSessionId: undefined,
      status: "pending",
      outputSummary: undefined,
      tokensUsed: { input: 0, output: 0, total: 0 },
      durationMs: 0,
      cost: 0,
      errorDetails: undefined,
      retryCount: 0,
      reassignedTo: undefined,
    });
  },
});

export const listByOrchestrationRunInternal = internalQuery({
  args: { orchestrationRunId: v.id("orchestrationRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentTaskExecutions")
      .withIndex("by_orchestration_run", (q) => q.eq("orchestrationRunId", args.orchestrationRunId))
      .collect();
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    executionId: v.id("agentTaskExecutions"),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("retrying"),
      v.literal("reassigned"),
    ),
    outputSummary: v.optional(v.string()),
    tokensUsed: v.optional(v.object({ input: v.number(), output: v.number(), total: v.number() })),
    durationMs: v.optional(v.number()),
    cost: v.optional(v.number()),
    errorDetails: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { executionId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(executionId, filtered);
  },
});
