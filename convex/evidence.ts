import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";

/** Generate a signed upload URL for evidence file storage. */
export const generateUploadUrl = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save an evidence file record after upload and link it to a requirement.
 * @param orgId - Organization ID
 * @param requirementId - Requirement this evidence supports
 * @param storageId - Convex storage ID from the upload
 * @param fileName - Original file name
 */
export const save = mutation({
  args: {
    orgId: v.string(),
    requirementId: v.id("requirements"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");

    const user = await getAuthUser(ctx);

    return await ctx.db.insert("evidence", {
      orgId: args.orgId,
      requirementId: args.requirementId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      uploadedBy: user._id,
    });
  },
});

/** List all evidence files for a requirement with download URLs. */
export const listByRequirement = query({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const records = await ctx.db
      .query("evidence")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();

    return await Promise.all(
      records.map(async (e) => ({
        ...e,
        downloadUrl: await ctx.storage.getUrl(e.storageId),
      })),
    );
  },
});

/** Delete an evidence file and its backing storage. */
export const remove = mutation({
  args: { evidenceId: v.id("evidence") },
  handler: async (ctx, args) => {
    const evidence = await ctx.db.get(args.evidenceId);
    if (!evidence) throw new Error("Evidence not found");

    const requirement = await ctx.db.get(evidence.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    await ctx.storage.delete(evidence.storageId);
    await ctx.db.delete(args.evidenceId);
  },
});
