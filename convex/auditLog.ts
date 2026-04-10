import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

/**
 * List audit log entries for a program, newest first. Optionally filter by entity type.
 * @param programId - The program to query
 * @param entityType - Optional entity type filter (e.g., "requirement", "task")
 * @param limit - Maximum entries to return (default 50)
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    entityType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const limit = args.limit ?? 50;

    let entries = await ctx.db
      .query("auditLog")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(limit);

    if (args.entityType !== undefined) {
      entries = entries.filter((e) => e.entityType === args.entityType);
    }

    return entries;
  },
});

/**
 * List audit log entries for a specific entity, newest first.
 * @param entityType - Entity type (e.g., "requirement", "task")
 * @param entityId - Entity ID to filter by
 */
export const listByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .collect();

    if (entries.length > 0) {
      await assertOrgAccess(ctx, entries[0].orgId);
    }

    return entries;
  },
});
