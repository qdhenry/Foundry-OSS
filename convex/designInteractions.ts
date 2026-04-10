import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

// ── Create ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    designAssetId: v.optional(v.id("designAssets")),
    componentName: v.string(),
    trigger: v.string(),
    animationType: v.string(),
    duration: v.optional(v.string()),
    easing: v.optional(v.string()),
    description: v.string(),
    codeSnippet: v.optional(v.string()),
    snippetLanguage: v.optional(v.string()),
    recordingFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const interactionId = await ctx.db.insert("designInteractions", {
      orgId: args.orgId,
      programId: args.programId,
      designAssetId: args.designAssetId,
      componentName: args.componentName,
      trigger: args.trigger,
      animationType: args.animationType,
      duration: args.duration,
      easing: args.easing,
      description: args.description,
      codeSnippet: args.codeSnippet,
      snippetLanguage: args.snippetLanguage,
      recordingFileId: args.recordingFileId,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "design_interaction",
      entityId: interactionId as string,
      action: "create",
      description: `Created design interaction for "${args.componentName}" (${args.trigger} → ${args.animationType})`,
    });

    return interactionId;
  },
});

// ── List by Program ───────────────────────────────────────────────

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("designInteractions")
      .withIndex("by_program", (q) => q.eq("orgId", program.orgId).eq("programId", args.programId))
      .collect();
  },
});

// ── Update ────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    interactionId: v.id("designInteractions"),
    componentName: v.optional(v.string()),
    trigger: v.optional(v.string()),
    animationType: v.optional(v.string()),
    duration: v.optional(v.string()),
    easing: v.optional(v.string()),
    description: v.optional(v.string()),
    codeSnippet: v.optional(v.string()),
    snippetLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const interaction = await ctx.db.get(args.interactionId);
    if (!interaction) throw new Error("Design interaction not found");
    await assertOrgAccess(ctx, interaction.orgId);

    const updateObj: Record<string, unknown> = {};
    const { interactionId: _, ...fields } = args;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updateObj[key] = value;
      }
    }

    if (Object.keys(updateObj).length > 0) {
      await ctx.db.patch(args.interactionId, updateObj);

      await logAuditEvent(ctx, {
        orgId: interaction.orgId,
        programId: interaction.programId as string,
        entityType: "design_interaction",
        entityId: args.interactionId as string,
        action: "update",
        description: `Updated design interaction for "${interaction.componentName}"`,
      });
    }
  },
});

// ── Remove ────────────────────────────────────────────────────────

export const remove = mutation({
  args: { interactionId: v.id("designInteractions") },
  handler: async (ctx, args) => {
    const interaction = await ctx.db.get(args.interactionId);
    if (!interaction) throw new Error("Design interaction not found");
    await assertOrgAccess(ctx, interaction.orgId);

    await ctx.db.delete(args.interactionId);

    await logAuditEvent(ctx, {
      orgId: interaction.orgId,
      programId: interaction.programId as string,
      entityType: "design_interaction",
      entityId: args.interactionId as string,
      action: "delete",
      description: `Deleted design interaction for "${interaction.componentName}" (${interaction.trigger} → ${interaction.animationType})`,
    });
  },
});
