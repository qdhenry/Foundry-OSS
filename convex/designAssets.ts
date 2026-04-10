import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const typeValidator = v.union(
  v.literal("screenshot"),
  v.literal("tokens"),
  v.literal("styleGuide"),
  v.literal("prototype"),
  v.literal("interactionSpec"),
  v.literal("animationSnippet"),
);

// ── Upload URL ────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.storage.generateUploadUrl();
  },
});

// ── Create ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    requirementId: v.optional(v.id("requirements")),
    name: v.string(),
    type: typeValidator,
    fileId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    content: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const status = args.type === "screenshot" ? "uploaded" : "analyzed";

    const assetId = await ctx.db.insert("designAssets", {
      orgId: args.orgId,
      programId: args.programId,
      workstreamId: args.workstreamId,
      requirementId: args.requirementId,
      name: args.name,
      type: args.type,
      fileId: args.fileId,
      externalUrl: args.externalUrl,
      content: args.content,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      tags: args.tags,
      version: 1,
      status,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "design_asset",
      entityId: assetId as string,
      action: "create",
      description: `Created design asset "${args.name}" (${args.type})`,
    });

    // Auto-trigger AI analysis for screenshots with attached files
    if (args.type === "screenshot" && args.fileId) {
      await ctx.scheduler.runAfter(0, internal.designAnalysisActions.analyzeScreenshot, {
        designAssetId: assetId as string,
        programId: args.programId as string,
        orgId: program.orgId,
      });
      await ctx.db.patch(assetId, { status: "analyzing" });
    }

    // Auto-trigger token import for token files with content
    if (args.type === "tokens" && args.content) {
      const ext = args.name?.split(".").pop()?.toLowerCase() ?? "json";
      const format = ext === "css" ? "css" : ext === "scss" ? "scss" : "json";
      await ctx.scheduler.runAfter(0, internal.designTokenSets.importFromContentInternal, {
        orgId: program.orgId,
        programId: args.programId as string,
        name: args.name,
        content: args.content,
        format,
        sourceAssetId: assetId as string,
      });
    }

    return assetId;
  },
});

// ── List by Program ───────────────────────────────────────────────

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const assets = await ctx.db
      .query("designAssets")
      .withIndex("by_program", (q) => q.eq("orgId", program.orgId).eq("programId", args.programId))
      .collect();

    return await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        fileUrl: asset.fileId ? await ctx.storage.getUrl(asset.fileId) : null,
      })),
    );
  },
});

// ── List by Workstream ────────────────────────────────────────────

export const listByWorkstream = query({
  args: {
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const assets = await ctx.db
      .query("designAssets")
      .withIndex("by_workstream", (q) =>
        q
          .eq("orgId", program.orgId)
          .eq("programId", args.programId)
          .eq("workstreamId", args.workstreamId),
      )
      .collect();

    return await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        fileUrl: asset.fileId ? await ctx.storage.getUrl(asset.fileId) : null,
      })),
    );
  },
});

// ── List by Requirement ───────────────────────────────────────────

export const listByRequirement = query({
  args: {
    programId: v.id("programs"),
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const assets = await ctx.db
      .query("designAssets")
      .withIndex("by_requirement", (q) =>
        q
          .eq("orgId", program.orgId)
          .eq("programId", args.programId)
          .eq("requirementId", args.requirementId),
      )
      .collect();

    return await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        fileUrl: asset.fileId ? await ctx.storage.getUrl(asset.fileId) : null,
      })),
    );
  },
});

// ── Get ───────────────────────────────────────────────────────────

export const get = query({
  args: { assetId: v.id("designAssets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Design asset not found");
    await assertOrgAccess(ctx, asset.orgId);

    return {
      ...asset,
      fileUrl: asset.fileId ? await ctx.storage.getUrl(asset.fileId) : null,
    };
  },
});

// ── Update ────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    assetId: v.id("designAssets"),
    name: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    workstreamId: v.optional(v.id("workstreams")),
    requirementId: v.optional(v.id("requirements")),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Design asset not found");
    await assertOrgAccess(ctx, asset.orgId);

    const updateObj: Record<string, unknown> = {};
    const { assetId: _, ...fields } = args;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updateObj[key] = value;
      }
    }

    if (Object.keys(updateObj).length > 0) {
      await ctx.db.patch(args.assetId, updateObj);

      await logAuditEvent(ctx, {
        orgId: asset.orgId,
        programId: asset.programId as string,
        entityType: "design_asset",
        entityId: args.assetId as string,
        action: "update",
        description: `Updated design asset "${asset.name}"`,
      });
    }
  },
});

// ── Remove ────────────────────────────────────────────────────────

export const remove = mutation({
  args: { assetId: v.id("designAssets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Design asset not found");
    await assertOrgAccess(ctx, asset.orgId);

    // Delete file from storage if present
    if (asset.fileId) {
      await ctx.storage.delete(asset.fileId);
    }

    // Delete associated designAnalyses
    const analyses = await ctx.db
      .query("designAnalyses")
      .withIndex("by_asset", (q) => q.eq("designAssetId", args.assetId))
      .collect();
    for (const analysis of analyses) {
      await ctx.db.delete(analysis._id);
    }

    // Delete associated designInteractions
    const interactions = await ctx.db
      .query("designInteractions")
      .withIndex("by_asset", (q) => q.eq("designAssetId", args.assetId))
      .collect();
    for (const interaction of interactions) {
      await ctx.db.delete(interaction._id);
    }

    // Delete associated designTokenSets (for token-type assets)
    if (asset.type === "tokens") {
      const tokenSets = await ctx.db
        .query("designTokenSets")
        .withIndex("by_program", (q) => q.eq("orgId", asset.orgId).eq("programId", asset.programId))
        .collect();
      for (const ts of tokenSets) {
        if (ts.sourceAssetId === args.assetId) {
          await ctx.db.delete(ts._id);
        }
      }
    }

    // Delete the asset
    await ctx.db.delete(args.assetId);

    await logAuditEvent(ctx, {
      orgId: asset.orgId,
      programId: asset.programId as string,
      entityType: "design_asset",
      entityId: args.assetId as string,
      action: "delete",
      description: `Deleted design asset "${asset.name}" (${asset.type})`,
    });
  },
});
