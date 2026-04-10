import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const sprintStatusValidator = v.union(
  v.literal("planning"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
);

/** List sprints for a program with optional workstream and status filters. */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    status: v.optional(sprintStatusValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    let sprints;

    if (args.workstreamId) {
      sprints = await ctx.db
        .query("sprints")
        .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId!))
        .collect();
      // Ensure they belong to this program
      sprints = sprints.filter((s) => s.programId === args.programId);
    } else {
      sprints = await ctx.db
        .query("sprints")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect();
    }

    if (args.status) {
      sprints = sprints.filter((s) => s.status === args.status);
    }

    sprints.sort((a, b) => {
      const wsCmp = a.workstreamId.localeCompare(b.workstreamId);
      if (wsCmp !== 0) return wsCmp;
      return a.number - b.number;
    });

    return sprints;
  },
});

/** List sprints belonging to a specific workstream, sorted by sprint number. */
export const listByWorkstream = query({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();

    sprints.sort((a, b) => a.number - b.number);

    return sprints;
  },
});

/** Retrieve a single sprint by ID. */
export const get = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    return sprint;
  },
});

/**
 * Create a new sprint with an auto-incrementing number within its workstream.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param workstreamId - Parent workstream
 * @param name - Sprint display name
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
    name: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, args.orgId);

    // Auto-increment: count existing sprints in this workstream + 1
    const existing = await ctx.db
      .query("sprints")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();

    const number = existing.length + 1;

    const sprintId = await ctx.db.insert("sprints", {
      orgId: args.orgId,
      programId: args.programId,
      workstreamId: args.workstreamId,
      name: args.name,
      number,
      startDate: args.startDate,
      endDate: args.endDate,
      goal: args.goal,
      status: "planning",
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "sprint",
      entityId: sprintId as string,
      action: "create",
      description: `Created sprint "${args.name}" (#${number})`,
    });

    return sprintId;
  },
});

/**
 * Update sprint metadata (name, dates, goal).
 * @param sprintId - The sprint to update
 */
export const update = mutation({
  args: {
    sprintId: v.id("sprints"),
    name: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    if (args.goal !== undefined) patch.goal = args.goal;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.sprintId, patch);
    }

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "update",
      description: `Updated sprint "${sprint.name}" (#${sprint.number})`,
    });
  },
});

/**
 * Activate a sprint. Automatically completes other active sprints in the same
 * workstream to enforce a single-active-sprint constraint.
 * @param sprintId - The sprint to activate
 */
export const activate = mutation({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    if (sprint.status !== "planning") {
      throw new ConvexError("Only sprints with planning status can be activated");
    }

    // Deactivate other active sprints in the same workstream
    const workstreamSprints = await ctx.db
      .query("sprints")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", sprint.workstreamId))
      .collect();

    for (const ws of workstreamSprints) {
      if (ws.status === "active" && ws._id !== args.sprintId) {
        await ctx.db.patch(ws._id, { status: "completed" });
      }
    }

    await ctx.db.patch(args.sprintId, { status: "active" });

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "status_change",
      description: `Activated sprint "${sprint.name}" (#${sprint.number})`,
    });
  },
});

/**
 * Mark an active sprint as completed.
 * @param sprintId - The sprint to complete
 */
export const complete = mutation({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    if (sprint.status !== "active") {
      throw new ConvexError("Only active sprints can be completed");
    }

    await ctx.db.patch(args.sprintId, { status: "completed" });

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "status_change",
      description: `Completed sprint "${sprint.name}" (#${sprint.number})`,
    });
  },
});

/**
 * Returns the first active sprint for a program (or null if none active).
 */
export const getActive = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return sprints.find((s) => s.status === "active") ?? null;
  },
});

// ---------------------------------------------------------------------------
// Internal queries for Phase 3 AI features
// ---------------------------------------------------------------------------

export const getById = internalQuery({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sprintId);
  },
});

export const getByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sprints")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

/**
 * Delete a sprint. Only sprints with "planning" status can be deleted.
 * @param sprintId - The sprint to delete
 */
export const remove = mutation({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    if (sprint.status !== "planning") {
      throw new ConvexError("Can only delete sprints with planning status");
    }

    await ctx.db.delete(args.sprintId);

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "delete",
      description: `Deleted sprint "${sprint.name}" (#${sprint.number})`,
    });
  },
});
