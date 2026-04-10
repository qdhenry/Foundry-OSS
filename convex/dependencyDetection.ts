import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

// ── Internal Queries ─────────────────────────────────────────────────

export const getAllWorkstreamsWithRequirements = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const enriched = await Promise.all(
      workstreams.map(async (ws) => {
        const requirements = await ctx.db
          .query("requirements")
          .withIndex("by_workstream", (q) => q.eq("workstreamId", ws._id))
          .collect();

        return {
          _id: ws._id,
          orgId: ws.orgId,
          name: ws.name,
          shortCode: ws.shortCode,
          requirements: requirements.map((r) => ({
            _id: r._id,
            title: r.title,
            description: r.description,
            status: r.status,
          })),
        };
      }),
    );

    return enriched;
  },
});

export const getExistingDependencies = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const deps = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const enriched = await Promise.all(
      deps.map(async (dep) => {
        const source = await ctx.db.get(dep.sourceWorkstreamId);
        const target = await ctx.db.get(dep.targetWorkstreamId);

        return {
          ...dep,
          sourceName: source?.name ?? "unknown",
          targetName: target?.name ?? "unknown",
        };
      }),
    );

    return enriched;
  },
});

// ── Internal Mutation ────────────────────────────────────────────────

export const suggestDependency = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    sourceWorkstreamId: v.id("workstreams"),
    targetWorkstreamId: v.id("workstreams"),
    dependencyType: v.union(v.literal("blocks"), v.literal("enables"), v.literal("conflicts")),
    description: v.string(),
    requirementIds: v.optional(v.array(v.id("requirements"))),
    confidence: v.number(),
    reasoning: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.sourceWorkstreamId === args.targetWorkstreamId) {
      throw new ConvexError("Source and target workstreams must be different");
    }

    const depId = await ctx.db.insert("workstreamDependencies", {
      orgId: args.orgId,
      programId: args.programId,
      sourceWorkstreamId: args.sourceWorkstreamId,
      targetWorkstreamId: args.targetWorkstreamId,
      dependencyType: args.dependencyType,
      description: args.description,
      requirementIds: args.requirementIds,
      status: "suggested",
      suggestedBy: "ai",
      aiConfidence: args.confidence,
    });

    return depId;
  },
});

// ── Public Mutations ─────────────────────────────────────────────────

export const approveDependency = mutation({
  args: { dependencyId: v.id("workstreamDependencies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const dep = await ctx.db.get(args.dependencyId);
    if (!dep) throw new ConvexError("Dependency not found");
    await assertOrgAccess(ctx, dep.orgId);

    if (dep.status !== "suggested") {
      throw new ConvexError("Only suggested dependencies can be approved");
    }

    await ctx.db.patch(args.dependencyId, {
      status: "approved",
      approvedBy: identity.subject,
      approvedAt: Date.now(),
    });

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
      description: `Approved AI-suggested dependency ${sourceName} -> ${targetName}`,
    });
  },
});

export const dismissDependency = mutation({
  args: { dependencyId: v.id("workstreamDependencies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

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
      description: `Dismissed AI-suggested dependency ${sourceName} -> ${targetName}`,
    });
  },
});

// ── Public Query ─────────────────────────────────────────────────────

export const getPendingSuggestions = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const deps = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Filter to suggested status only
    const suggested = deps.filter((d) => d.status === "suggested");

    // Enrich with workstream names
    const enriched = await Promise.all(
      suggested.map(async (dep) => {
        const source = await ctx.db.get(dep.sourceWorkstreamId);
        const target = await ctx.db.get(dep.targetWorkstreamId);

        return {
          ...dep,
          sourceWorkstream: source
            ? { _id: source._id, name: source.name, shortCode: source.shortCode }
            : null,
          targetWorkstream: target
            ? { _id: target._id, name: target.name, shortCode: target.shortCode }
            : null,
        };
      }),
    );

    // Sort by confidence descending
    enriched.sort((a, b) => (b.aiConfidence ?? 0) - (a.aiConfidence ?? 0));

    return enriched;
  },
});
