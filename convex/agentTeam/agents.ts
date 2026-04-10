import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";
import {
  agentModelValidator,
  agentRoleValidator,
  agentStatusValidator,
  personalityProfileValidator,
  tokenBudgetValidator,
} from "./schema";

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("programAgents")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

export const listByProgramStatus = query({
  args: {
    programId: v.id("programs"),
    status: agentStatusValidator,
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("programAgents")
      .withIndex("by_program_status", (q) =>
        q.eq("programId", args.programId).eq("status", args.status),
      )
      .collect();
  },
});

export const get = query({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);
    return agent;
  },
});

// Internal versions for workflow/orchestration context (no auth check)
export const getInternal = internalQuery({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    agentId: v.id("programAgents"),
    status: agentStatusValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, { status: args.status });
  },
});

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    templateId: v.optional(v.id("agentTemplates")),
    name: v.string(),
    description: v.string(),
    role: agentRoleValidator,
    model: agentModelValidator,
    tools: v.array(v.string()),
    systemPrompt: v.string(),
    constraints: v.array(v.string()),
    specializations: v.array(v.string()),
    personalityProfile: personalityProfileValidator,
    avatarSeed: v.string(),
    skillIds: v.array(v.id("skills")),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
    tokenBudget: tokenBudgetValidator,
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);

    const agentId = await ctx.db.insert("programAgents", {
      ...args,
      status: "idle",
      currentVersion: 1,
      createdBy: user._id,
    });

    await ctx.db.insert("agentVersions", {
      orgId: args.orgId,
      agentId,
      version: 1,
      diff: { initial: true },
      snapshot: {
        name: args.name,
        description: args.description,
        role: args.role,
        model: args.model,
        tools: args.tools,
        systemPrompt: args.systemPrompt,
        constraints: args.constraints,
        specializations: args.specializations,
        tokenBudget: args.tokenBudget,
      },
      editedBy: user._id,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "programAgent",
      entityId: agentId as string,
      action: "create",
      description: `Created agent "${args.name}" (${args.role})`,
    });

    return agentId;
  },
});

export const update = mutation({
  args: {
    agentId: v.id("programAgents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    role: v.optional(agentRoleValidator),
    model: v.optional(agentModelValidator),
    tools: v.optional(v.array(v.string())),
    systemPrompt: v.optional(v.string()),
    constraints: v.optional(v.array(v.string())),
    specializations: v.optional(v.array(v.string())),
    personalityProfile: personalityProfileValidator,
    skillIds: v.optional(v.array(v.id("skills"))),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
    tokenBudget: v.optional(tokenBudgetValidator),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const user = await assertOrgAccess(ctx, agent.orgId);

    const { agentId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, newValue] of Object.entries(filtered)) {
      const previousValue = (agent as Record<string, unknown>)[key];
      if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
        diff[key] = { from: previousValue, to: newValue };
      }
    }

    if (Object.keys(diff).length === 0) return;

    const newVersion = agent.currentVersion + 1;
    await ctx.db.patch(agentId, { ...filtered, currentVersion: newVersion });
    const updated = await ctx.db.get(agentId);
    if (!updated) throw new Error("Agent not found after update");

    await ctx.db.insert("agentVersions", {
      orgId: agent.orgId,
      agentId,
      version: newVersion,
      diff,
      snapshot: {
        name: updated.name,
        description: updated.description,
        role: updated.role,
        model: updated.model,
        tools: updated.tools,
        systemPrompt: updated.systemPrompt,
        constraints: updated.constraints,
        specializations: updated.specializations,
        tokenBudget: updated.tokenBudget,
      },
      editedBy: user._id,
    });

    await logAuditEvent(ctx, {
      orgId: agent.orgId,
      programId: agent.programId as string,
      entityType: "programAgent",
      entityId: agentId as string,
      action: "update",
      description: `Updated agent "${agent.name}" to v${newVersion}`,
    });
  },
});

export const updateStatus = mutation({
  args: {
    agentId: v.id("programAgents"),
    status: agentStatusValidator,
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);

    await ctx.db.patch(args.agentId, { status: args.status });

    await logAuditEvent(ctx, {
      orgId: agent.orgId,
      programId: agent.programId as string,
      entityType: "programAgent",
      entityId: args.agentId as string,
      action: "status_change",
      description: `Changed agent "${agent.name}" status to ${args.status}`,
    });
  },
});

export const archive = mutation({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);

    await ctx.db.patch(args.agentId, { status: "archived" });

    await logAuditEvent(ctx, {
      orgId: agent.orgId,
      programId: agent.programId as string,
      entityType: "programAgent",
      entityId: args.agentId as string,
      action: "status_change",
      description: `Archived agent "${agent.name}"`,
    });
  },
});

export const remove = mutation({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);

    await ctx.db.delete(args.agentId);

    await logAuditEvent(ctx, {
      orgId: agent.orgId,
      programId: agent.programId as string,
      entityType: "programAgent",
      entityId: args.agentId as string,
      action: "delete",
      description: `Deleted agent "${agent.name}"`,
    });
  },
});

export const createBatch = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    agents: v.array(
      v.object({
        templateId: v.optional(v.id("agentTemplates")),
        name: v.string(),
        description: v.string(),
        role: agentRoleValidator,
        model: agentModelValidator,
        tools: v.array(v.string()),
        systemPrompt: v.string(),
        constraints: v.array(v.string()),
        specializations: v.array(v.string()),
        personalityProfile: personalityProfileValidator,
        avatarSeed: v.string(),
        skillIds: v.array(v.id("skills")),
        workstreamIds: v.optional(v.array(v.id("workstreams"))),
        tokenBudget: tokenBudgetValidator,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);
    const agentIds = [];

    for (const agentData of args.agents) {
      const agentId = await ctx.db.insert("programAgents", {
        ...agentData,
        orgId: args.orgId,
        programId: args.programId,
        status: "idle",
        currentVersion: 1,
        createdBy: user._id,
      });

      await ctx.db.insert("agentVersions", {
        orgId: args.orgId,
        agentId,
        version: 1,
        diff: { initial: true },
        snapshot: {
          name: agentData.name,
          role: agentData.role,
          model: agentData.model,
          tools: agentData.tools,
          systemPrompt: agentData.systemPrompt,
          constraints: agentData.constraints,
          specializations: agentData.specializations,
          tokenBudget: agentData.tokenBudget,
        },
        editedBy: user._id,
      });

      agentIds.push(agentId);
    }

    await ctx.db.patch(args.programId, { agentTeamGenerated: true });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "programAgent",
      entityId: args.programId as string,
      action: "create",
      description: `Generated agent team with ${args.agents.length} agents`,
      metadata: { generatedAgentIds: agentIds },
    });

    return agentIds;
  },
});
