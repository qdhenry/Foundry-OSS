import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { agentModelValidator } from "../agentTeam/schema";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["previewing"],
  previewing: ["running", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
};

// ── Mutations ────────────────────────────────────────────────────────────────

export const pauseAgent = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    agentId: v.id("programAgents"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new ConvexError("Agent not found");

    await ctx.db.patch(args.agentId, { status: "paused" });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "agent_paused",
      agentId: args.agentId,
      message: `Paused agent "${agent.name}"`,
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Paused agent "${agent.name}" in orchestration run "${run.name}"`,
    });
  },
});

export const resumeAgent = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    agentId: v.id("programAgents"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new ConvexError("Agent not found");

    await ctx.db.patch(args.agentId, { status: "idle" });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "agent_resumed",
      agentId: args.agentId,
      message: `Resumed agent "${agent.name}"`,
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Resumed agent "${agent.name}" in orchestration run "${run.name}"`,
    });
  },
});

export const reassignTask = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    executionId: v.id("agentTaskExecutions"),
    newAgentId: v.id("programAgents"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new ConvexError("Task execution not found");

    const newAgent = await ctx.db.get(args.newAgentId);
    if (!newAgent) throw new ConvexError("New agent not found");

    if (newAgent.status !== "idle" && newAgent.status !== "active") {
      throw new ConvexError(
        `Cannot reassign to agent "${newAgent.name}" — status is "${newAgent.status}", must be idle or active`,
      );
    }

    // Mark old execution as reassigned
    await ctx.db.patch(args.executionId, {
      status: "reassigned",
      reassignedTo: args.newAgentId,
    });

    // Update old agent to idle
    await ctx.db.patch(execution.agentId, { status: "idle" });

    // Update new agent to executing
    await ctx.db.patch(args.newAgentId, { status: "executing" });

    // Get current version for the new agent
    const newAgentVersions = await ctx.db
      .query("agentVersions")
      .withIndex("by_agent_version", (q) =>
        q.eq("agentId", args.newAgentId).eq("version", newAgent.currentVersion),
      )
      .unique();

    // Create new execution record for the new agent
    await ctx.db.insert("agentTaskExecutions", {
      orgId: run.orgId,
      programId: run.programId,
      agentId: args.newAgentId,
      agentVersionId: newAgentVersions?._id ?? execution.agentVersionId,
      sprintWorkflowId: execution.sprintWorkflowId,
      taskId: execution.taskId,
      executionMode: execution.executionMode,
      status: "pending",
      inputSummary: execution.inputSummary,
      tokensUsed: { input: 0, output: 0, total: 0 },
      durationMs: 0,
      cost: 0,
      retryCount: 0,
      orchestrationRunId: run._id,
    });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "task_reassigned",
      agentId: args.newAgentId,
      taskId: execution.taskId,
      message: `Reassigned task from agent to "${newAgent.name}"`,
      metadata: {
        oldExecutionId: args.executionId,
        oldAgentId: execution.agentId,
      },
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Reassigned task execution to agent "${newAgent.name}" in run "${run.name}"`,
    });
  },
});

export const addTask = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");

    // Add taskId to the execution plan metadata
    const currentPlan = (run.executionPlan as Record<string, unknown>) ?? {};
    const addedTasks = (currentPlan.addedTasks as string[]) ?? [];
    addedTasks.push(args.taskId as string);

    await ctx.db.patch(args.runId, {
      executionPlan: { ...currentPlan, addedTasks },
    });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "task_added",
      taskId: args.taskId,
      message: `Added task "${task.title ?? args.taskId}" to orchestration run`,
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Added task to orchestration run "${run.name}"`,
    });
  },
});

export const cancelRun = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const allowed = ALLOWED_TRANSITIONS[run.status];
    if (!allowed?.includes("cancelled")) {
      throw new ConvexError(`Cannot cancel run in "${run.status}" status`);
    }

    await ctx.db.patch(args.runId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "run_cancelled",
      message: `Cancelled orchestration run "${run.name}"`,
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "status_change",
      description: `Cancelled orchestration run "${run.name}"`,
    });
  },
});

export const escalateModel = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    agentId: v.id("programAgents"),
    newModel: agentModelValidator,
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new ConvexError("Agent not found");

    // Store model override in execution plan metadata
    const currentPlan = (run.executionPlan as Record<string, unknown>) ?? {};
    const modelOverrides = (currentPlan.modelOverrides as Record<string, string>) ?? {};
    modelOverrides[args.agentId as string] = args.newModel;

    await ctx.db.patch(args.runId, {
      executionPlan: { ...currentPlan, modelOverrides },
    });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "model_escalated",
      agentId: args.agentId,
      message: `Escalated agent "${agent.name}" model to ${args.newModel}`,
      metadata: {
        previousModel: agent.model,
        newModel: args.newModel,
      },
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Escalated model for agent "${agent.name}" to ${args.newModel} in run "${run.name}"`,
    });
  },
});

export const updateBudget = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    newTokenBudget: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    const previousBudget = run.tokenBudget;
    await ctx.db.patch(args.runId, { tokenBudget: args.newTokenBudget });

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: "budget_warning",
      message: `Updated token budget from ${previousBudget} to ${args.newTokenBudget}`,
      metadata: {
        previousBudget,
        newBudget: args.newTokenBudget,
      },
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Updated token budget to ${args.newTokenBudget} for run "${run.name}"`,
    });
  },
});
