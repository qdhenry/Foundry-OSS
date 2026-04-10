import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";
import { agentModelValidator, agentRoleValidator, personalityProfileValidator } from "./schema";

export const listByOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("agentTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const get = query({
  args: { templateId: v.id("agentTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    await assertOrgAccess(ctx, template.orgId);
    return template;
  },
});

export const create = mutation({
  args: {
    orgId: v.string(),
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
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);
    const templateId = await ctx.db.insert("agentTemplates", {
      ...args,
      createdBy: user._id,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: "",
      entityType: "agentTemplate",
      entityId: templateId as string,
      action: "create",
      description: `Created agent template "${args.name}"`,
    });

    return templateId;
  },
});

export const update = mutation({
  args: {
    templateId: v.id("agentTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    role: v.optional(agentRoleValidator),
    model: v.optional(agentModelValidator),
    tools: v.optional(v.array(v.string())),
    systemPrompt: v.optional(v.string()),
    constraints: v.optional(v.array(v.string())),
    specializations: v.optional(v.array(v.string())),
    personalityProfile: personalityProfileValidator,
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    await assertOrgAccess(ctx, template.orgId);

    const { templateId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(filtered).length === 0) return;

    await ctx.db.patch(templateId, filtered);

    await logAuditEvent(ctx, {
      orgId: template.orgId,
      programId: "",
      entityType: "agentTemplate",
      entityId: templateId as string,
      action: "update",
      description: `Updated agent template "${template.name}"`,
    });
  },
});

export const remove = mutation({
  args: { templateId: v.id("agentTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    await assertOrgAccess(ctx, template.orgId);

    await ctx.db.delete(args.templateId);

    await logAuditEvent(ctx, {
      orgId: template.orgId,
      programId: "",
      entityType: "agentTemplate",
      entityId: args.templateId as string,
      action: "delete",
      description: `Deleted agent template "${template.name}"`,
    });
  },
});
