import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const statusValidator = v.union(
  v.literal("active"),
  v.literal("resolved"),
  v.literal("blocked"),
  v.literal("suggested"),
  v.literal("approved"),
);

// ── Queries ──────────────────────────────────────────────────────────

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const deps = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Resolve source and target workstream names for display
    const enriched = await Promise.all(
      deps.map(async (dep) => {
        const sourceWorkstream = await ctx.db.get(dep.sourceWorkstreamId);
        const targetWorkstream = await ctx.db.get(dep.targetWorkstreamId);

        return {
          ...dep,
          sourceWorkstream: sourceWorkstream
            ? {
                _id: sourceWorkstream._id,
                name: sourceWorkstream.name,
                shortCode: sourceWorkstream.shortCode,
              }
            : null,
          targetWorkstream: targetWorkstream
            ? {
                _id: targetWorkstream._id,
                name: targetWorkstream.name,
                shortCode: targetWorkstream.shortCode,
              }
            : null,
        };
      }),
    );

    return enriched;
  },
});

export const listByWorkstream = query({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    // Fetch dependencies where this workstream is the source
    const asSource = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_source", (q) => q.eq("sourceWorkstreamId", args.workstreamId))
      .collect();

    // Fetch dependencies where this workstream is the target
    const asTarget = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_target", (q) => q.eq("targetWorkstreamId", args.workstreamId))
      .collect();

    // Merge and dedupe by _id
    const seen = new Set<string>();
    const merged = [];
    for (const dep of [...asSource, ...asTarget]) {
      if (!seen.has(dep._id)) {
        seen.add(dep._id);
        merged.push(dep);
      }
    }

    // Resolve workstream names
    const enriched = await Promise.all(
      merged.map(async (dep) => {
        const sourceWorkstream = await ctx.db.get(dep.sourceWorkstreamId);
        const targetWorkstream = await ctx.db.get(dep.targetWorkstreamId);

        return {
          ...dep,
          sourceWorkstream: sourceWorkstream
            ? {
                _id: sourceWorkstream._id,
                name: sourceWorkstream.name,
                shortCode: sourceWorkstream.shortCode,
              }
            : null,
          targetWorkstream: targetWorkstream
            ? {
                _id: targetWorkstream._id,
                name: targetWorkstream.name,
                shortCode: targetWorkstream.shortCode,
              }
            : null,
        };
      }),
    );

    return enriched;
  },
});

// ── Mutations ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    sourceWorkstreamId: v.id("workstreams"),
    targetWorkstreamId: v.id("workstreams"),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Validate source !== target
    if (args.sourceWorkstreamId === args.targetWorkstreamId) {
      throw new ConvexError("Source and target workstreams must be different");
    }

    const depId = await ctx.db.insert("workstreamDependencies", {
      orgId: args.orgId,
      programId: args.programId,
      sourceWorkstreamId: args.sourceWorkstreamId,
      targetWorkstreamId: args.targetWorkstreamId,
      description: args.description,
      status: args.status ?? "active",
    });

    // Resolve names for audit description
    const source = await ctx.db.get(args.sourceWorkstreamId);
    const target = await ctx.db.get(args.targetWorkstreamId);
    const sourceName = source?.shortCode ?? "unknown";
    const targetName = target?.shortCode ?? "unknown";

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "workstreamDependency",
      entityId: depId as string,
      action: "create",
      description: `Created dependency ${sourceName} -> ${targetName}`,
    });

    return depId;
  },
});

export const update = mutation({
  args: {
    dependencyId: v.id("workstreamDependencies"),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.dependencyId);
    if (!dep) throw new ConvexError("Dependency not found");
    await assertOrgAccess(ctx, dep.orgId);

    const { dependencyId: _, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.dependencyId, patch);

      const source = await ctx.db.get(dep.sourceWorkstreamId);
      const target = await ctx.db.get(dep.targetWorkstreamId);
      const sourceName = source?.shortCode ?? "unknown";
      const targetName = target?.shortCode ?? "unknown";

      await logAuditEvent(ctx, {
        orgId: dep.orgId,
        programId: dep.programId as string,
        entityType: "workstreamDependency",
        entityId: args.dependencyId as string,
        action: "update",
        description: `Updated dependency ${sourceName} -> ${targetName}`,
        metadata: { updatedFields: Object.keys(patch) },
      });
    }
  },
});

export const updateStatus = mutation({
  args: {
    dependencyId: v.id("workstreamDependencies"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.dependencyId);
    if (!dep) throw new ConvexError("Dependency not found");
    await assertOrgAccess(ctx, dep.orgId);

    const oldStatus = dep.status;
    await ctx.db.patch(args.dependencyId, { status: args.status });

    const source = await ctx.db.get(dep.sourceWorkstreamId);
    const target = await ctx.db.get(dep.targetWorkstreamId);
    const sourceName = source?.shortCode ?? "unknown";
    const targetName = target?.shortCode ?? "unknown";

    await logAuditEvent(ctx, {
      orgId: dep.orgId,
      programId: dep.programId as string,
      entityType: "workstreamDependency",
      entityId: args.dependencyId as string,
      action: "status_change",
      description: `Changed dependency ${sourceName} -> ${targetName} status from ${oldStatus} to ${args.status}`,
      metadata: { oldStatus, newStatus: args.status },
    });
  },
});

export const remove = mutation({
  args: { dependencyId: v.id("workstreamDependencies") },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.dependencyId);
    if (!dep) throw new ConvexError("Dependency not found");
    await assertOrgAccess(ctx, dep.orgId);

    const source = await ctx.db.get(dep.sourceWorkstreamId);
    const target = await ctx.db.get(dep.targetWorkstreamId);
    const sourceName = source?.shortCode ?? "unknown";
    const targetName = target?.shortCode ?? "unknown";

    await ctx.db.delete(args.dependencyId);

    await logAuditEvent(ctx, {
      orgId: dep.orgId,
      programId: dep.programId as string,
      entityType: "workstreamDependency",
      entityId: args.dependencyId as string,
      action: "delete",
      description: `Deleted dependency ${sourceName} -> ${targetName}`,
    });
  },
});
