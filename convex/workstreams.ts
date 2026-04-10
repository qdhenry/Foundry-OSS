import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

/** List all workstreams for a program, sorted by sortOrder. */
export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return workstreams.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Retrieve a single workstream by ID. */
export const get = query({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    return workstream;
  },
});

/**
 * Update workstream properties such as name, status, owner, or sprint cadence.
 * @param workstreamId - The workstream to update
 */
export const update = mutation({
  args: {
    workstreamId: v.id("workstreams"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("blocked"))),
    ownerId: v.optional(v.id("users")),
    description: v.optional(v.string()),
    sprintCadence: v.optional(v.number()),
    currentSprint: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    const { workstreamId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.ownerId !== undefined) patch.ownerId = updates.ownerId;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.sprintCadence !== undefined) patch.sprintCadence = updates.sprintCadence;
    if (updates.currentSprint !== undefined) patch.currentSprint = updates.currentSprint;

    await ctx.db.patch(workstreamId, patch);
  },
});

// Internal query for agent context — returns shortCode, name, description
export const listByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return workstreams
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((w) => ({
        _id: w._id,
        shortCode: w.shortCode,
        name: w.name,
        description: w.description,
      }));
  },
});
