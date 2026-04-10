import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";

export const create = mutation({
  args: {
    programId: v.id("programs"),
    page: v.optional(v.string()),
    eventType: v.string(),
    message: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const eventType = args.eventType.trim();
    const message = args.message.trim();
    if (!eventType) throw new ConvexError("eventType is required");
    if (!message) throw new ConvexError("message is required");

    const user = await getAuthUser(ctx);
    const eventId = await ctx.db.insert("activityEvents", {
      orgId: program.orgId,
      programId: args.programId,
      page: args.page,
      eventType,
      message,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
      userId: user._id,
      userName: user.name,
      createdAt: Date.now(),
    });

    return { eventId };
  },
});

export const listRecent = query({
  args: {
    programId: v.id("programs"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("activityEvents")
      .withIndex("by_program_createdAt", (q) => q.eq("programId", args.programId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
