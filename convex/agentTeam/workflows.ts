import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";

const workflowStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const assignmentValidator = v.object({
  agentId: v.id("programAgents"),
  taskId: v.id("tasks"),
  status: v.string(),
  sandboxSessionId: v.optional(v.id("sandboxSessions")),
});

const updateStatusArgs = {
  sprintWorkflowId: v.id("sprintWorkflows"),
  status: workflowStatusValidator,
  pausedBy: v.optional(v.id("users")),
  prUrl: v.optional(v.string()),
  workflowId: v.optional(v.string()),
};

async function getWorkflowOrThrow(ctx: MutationCtx, sprintWorkflowId: Id<"sprintWorkflows">) {
  const workflow = await ctx.db.get(sprintWorkflowId);
  if (!workflow) throw new Error("Workflow not found");
  return workflow;
}

async function updateWorkflowStatus(
  ctx: MutationCtx,
  args: {
    sprintWorkflowId: Id<"sprintWorkflows">;
    status: string;
    pausedBy?: Id<"users">;
    prUrl?: string;
    workflowId?: string;
  },
) {
  const workflow = await getWorkflowOrThrow(ctx, args.sprintWorkflowId);

  const update: Record<string, unknown> = {
    status: args.status,
  };

  if (args.pausedBy !== undefined) update.pausedBy = args.pausedBy;
  if (args.prUrl !== undefined) update.prUrl = args.prUrl;
  if (args.workflowId !== undefined) update.workflowId = args.workflowId;
  if (["completed", "failed", "cancelled"].includes(args.status)) {
    update.completedAt = Date.now();
  }

  await ctx.db.patch(args.sprintWorkflowId, update);

  return workflow;
}

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("sprintWorkflows")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(50);
  },
});

export const get = query({
  args: { sprintWorkflowId: v.id("sprintWorkflows") },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.sprintWorkflowId);
    if (!workflow) throw new Error("Workflow not found");
    await assertOrgAccess(ctx, workflow.orgId);
    return workflow;
  },
});

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    sprintId: v.id("sprintGates"),
    branchName: v.string(),
    startedBy: v.id("users"),
    workflowId: v.optional(v.string()),
    agentAssignments: v.array(assignmentValidator),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const sprintWorkflowId = await ctx.db.insert("sprintWorkflows", {
      orgId: args.orgId,
      programId: args.programId,
      sprintId: args.sprintId,
      workflowId: args.workflowId,
      status: "pending",
      branchName: args.branchName,
      prUrl: undefined,
      agentAssignments: args.agentAssignments,
      totalTokensUsed: 0,
      totalCost: 0,
      startedAt: Date.now(),
      completedAt: undefined,
      startedBy: args.startedBy,
      pausedBy: undefined,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "sprintWorkflow",
      entityId: sprintWorkflowId as string,
      action: "create",
      description: `Created sprint workflow ${args.branchName}`,
    });

    return sprintWorkflowId;
  },
});

export const updateStatus = mutation({
  args: updateStatusArgs,
  handler: async (ctx, args) => {
    const workflow = await getWorkflowOrThrow(ctx, args.sprintWorkflowId);
    await assertOrgAccess(ctx, workflow.orgId);

    await updateWorkflowStatus(ctx, args);

    await logAuditEvent(ctx, {
      orgId: workflow.orgId,
      programId: workflow.programId as string,
      entityType: "sprintWorkflow",
      entityId: args.sprintWorkflowId as string,
      action: "status_change",
      description: `Set sprint workflow status to ${args.status}`,
    });
  },
});

export const updateStatusInternal = internalMutation({
  args: updateStatusArgs,
  handler: async (ctx, args) => {
    await updateWorkflowStatus(ctx, args);
  },
});

export const updateAssignments = mutation({
  args: {
    sprintWorkflowId: v.id("sprintWorkflows"),
    agentAssignments: v.array(assignmentValidator),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.sprintWorkflowId);
    if (!workflow) throw new Error("Workflow not found");
    await assertOrgAccess(ctx, workflow.orgId);

    await ctx.db.patch(args.sprintWorkflowId, {
      agentAssignments: args.agentAssignments,
    });
  },
});

export const updateUsage = mutation({
  args: {
    sprintWorkflowId: v.id("sprintWorkflows"),
    totalTokensUsed: v.number(),
    totalCost: v.number(),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.sprintWorkflowId);
    if (!workflow) throw new Error("Workflow not found");
    await assertOrgAccess(ctx, workflow.orgId);

    await ctx.db.patch(args.sprintWorkflowId, {
      totalTokensUsed: args.totalTokensUsed,
      totalCost: args.totalCost,
    });
  },
});
