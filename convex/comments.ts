import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";
import { logAuditEvent } from "./model/audit";

/**
 * List comments on an entity with resolved author names and avatars.
 * @param entityType - Type of entity (requirement, risk, task, skill, gate, integration)
 * @param entityId - Entity ID to fetch comments for
 */
export const listByEntity = query({
  args: {
    entityType: v.union(
      v.literal("requirement"),
      v.literal("risk"),
      v.literal("task"),
      v.literal("skill"),
      v.literal("gate"),
      v.literal("integration"),
    ),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .collect();

    if (comments.length > 0) {
      await assertOrgAccess(ctx, comments[0].orgId);
    }

    return await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          authorName: author?.name ?? "Unknown",
          authorAvatarUrl: author?.avatarUrl,
        };
      }),
    );
  },
});

/**
 * Add a comment to an entity. Supports threaded replies via parentId.
 * @param orgId - Organization ID
 * @param programId - Program the entity belongs to
 * @param entityType - Type of entity being commented on
 * @param entityId - Entity ID
 * @param content - Comment text
 * @param parentId - Optional parent comment for threading
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    entityType: v.union(
      v.literal("requirement"),
      v.literal("risk"),
      v.literal("task"),
      v.literal("skill"),
      v.literal("gate"),
      v.literal("integration"),
    ),
    entityId: v.string(),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const user = await getAuthUser(ctx);

    const commentId = await ctx.db.insert("comments", {
      orgId: program.orgId,
      programId: args.programId,
      entityType: args.entityType,
      entityId: args.entityId,
      authorId: user._id,
      content: args.content,
      parentId: args.parentId,
    });

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: args.entityType,
      entityId: args.entityId,
      action: "create",
      description: `Added comment on ${args.entityType}`,
    });

    return commentId;
  },
});

/** Delete a comment. Only the original author can delete their own comments. */
export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    await assertOrgAccess(ctx, comment.orgId);

    const user = await getAuthUser(ctx);
    if (comment.authorId !== user._id) {
      throw new ConvexError("You can only delete your own comments");
    }

    await ctx.db.delete(args.commentId);

    await logAuditEvent(ctx, {
      orgId: comment.orgId,
      programId: comment.programId as string,
      entityType: comment.entityType,
      entityId: comment.entityId,
      action: "delete",
      description: `Deleted comment on ${comment.entityType}`,
    });
  },
});
