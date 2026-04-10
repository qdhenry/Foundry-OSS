import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { resolveDesignCascade } from "./model/designCascade";

// ── createForTask ─────────────────────────────────────────────────────────────
// Called asynchronously via ctx.scheduler.runAfter(0) from the task create
// mutation. Resolves the full design cascade for the task context and persists
// an immutable snapshot into taskDesignSnapshots.

export const createForTask = internalMutation({
  args: {
    orgId: v.string(),
    taskId: v.id("tasks"),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    requirementId: v.optional(v.id("requirements")),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveDesignCascade(ctx, {
      orgId: args.orgId,
      programId: args.programId,
      workstreamId: args.workstreamId,
      requirementId: args.requirementId,
    });

    // Skip snapshot if no design context exists
    const hasAssets = resolved.assetIds.length > 0;
    const hasTokens = Object.keys(resolved.resolvedTokens).length > 0;
    if (!hasAssets && !hasTokens) {
      return null;
    }

    // Build codeArtifacts JSON from the token set if present
    let codeArtifacts: string | undefined;
    if (resolved.tokenSetId) {
      const tokenSet = await ctx.db.get(resolved.tokenSetId);
      if (tokenSet) {
        const artifacts: {
          tailwindConfig?: string;
          cssVariables?: string;
          scssVariables?: string;
          jsonTokens?: string;
        } = {};
        if (tokenSet.tailwindConfig) artifacts.tailwindConfig = tokenSet.tailwindConfig;
        if (tokenSet.cssVariables) artifacts.cssVariables = tokenSet.cssVariables;
        if (tokenSet.scssVariables) artifacts.scssVariables = tokenSet.scssVariables;
        if (tokenSet.jsonTokens) artifacts.jsonTokens = tokenSet.jsonTokens;
        if (Object.keys(artifacts).length > 0) {
          codeArtifacts = JSON.stringify(artifacts);
        }
      }
    }

    const snapshotId = await ctx.db.insert("taskDesignSnapshots", {
      orgId: args.orgId,
      taskId: args.taskId,
      programId: args.programId,
      resolvedTokens: JSON.stringify(resolved.resolvedTokens),
      resolvedComponents: JSON.stringify(resolved.resolvedComponents),
      screenSpecs: resolved.screenSpecs ?? undefined,
      interactionSpecs:
        resolved.interactionSpecs.length > 0
          ? JSON.stringify(resolved.interactionSpecs)
          : undefined,
      codeArtifacts,
      assetIds: resolved.assetIds,
      tokenSetId: resolved.tokenSetId ?? undefined,
      snapshotVersion: 1,
      degraded: resolved.degraded,
      createdAt: Date.now(),
    });

    // Mark the task as having a design snapshot
    await ctx.db.patch(args.taskId, { hasDesignSnapshot: true });

    return snapshotId;
  },
});

// ── getByTask ─────────────────────────────────────────────────────────────────
// Public query — returns the latest snapshot for a task.

export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertOrgAccess(ctx, task.orgId);

    const snapshots = await ctx.db
      .query("taskDesignSnapshots")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    if (snapshots.length === 0) return null;

    // Return the latest snapshot (last element after collect, ordered by insertion)
    return snapshots[snapshots.length - 1];
  },
});

// ── refreshForTask ───────────────────────────────────────────────────────────
// Public mutation — (re)creates a design snapshot for an existing task.
// Used when design assets are added after task creation.

export const refreshForTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const resolved = await resolveDesignCascade(ctx, {
      orgId: task.orgId,
      programId: task.programId,
      workstreamId: task.workstreamId ?? undefined,
      requirementId: task.requirementId ?? undefined,
    });

    const hasAssets = resolved.assetIds.length > 0;
    const hasTokens = Object.keys(resolved.resolvedTokens).length > 0;
    if (!hasAssets && !hasTokens) {
      return null;
    }

    // Build codeArtifacts JSON from the token set if present
    let codeArtifacts: string | undefined;
    if (resolved.tokenSetId) {
      const tokenSet = await ctx.db.get(resolved.tokenSetId);
      if (tokenSet) {
        const artifacts: {
          tailwindConfig?: string;
          cssVariables?: string;
          scssVariables?: string;
          jsonTokens?: string;
        } = {};
        if (tokenSet.tailwindConfig) artifacts.tailwindConfig = tokenSet.tailwindConfig;
        if (tokenSet.cssVariables) artifacts.cssVariables = tokenSet.cssVariables;
        if (tokenSet.scssVariables) artifacts.scssVariables = tokenSet.scssVariables;
        if (tokenSet.jsonTokens) artifacts.jsonTokens = tokenSet.jsonTokens;
        if (Object.keys(artifacts).length > 0) {
          codeArtifacts = JSON.stringify(artifacts);
        }
      }
    }

    // Determine next snapshot version
    const existing = await ctx.db
      .query("taskDesignSnapshots")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    const nextVersion =
      existing.length > 0 ? Math.max(...existing.map((s) => s.snapshotVersion)) + 1 : 1;

    const snapshotId = await ctx.db.insert("taskDesignSnapshots", {
      orgId: task.orgId,
      taskId: args.taskId,
      programId: task.programId,
      resolvedTokens: JSON.stringify(resolved.resolvedTokens),
      resolvedComponents: JSON.stringify(resolved.resolvedComponents),
      screenSpecs: resolved.screenSpecs ?? undefined,
      interactionSpecs:
        resolved.interactionSpecs.length > 0
          ? JSON.stringify(resolved.interactionSpecs)
          : undefined,
      codeArtifacts,
      assetIds: resolved.assetIds,
      tokenSetId: resolved.tokenSetId ?? undefined,
      snapshotVersion: nextVersion,
      degraded: resolved.degraded,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.taskId, { hasDesignSnapshot: true });

    return snapshotId;
  },
});

// ── getByTaskInternal ─────────────────────────────────────────────────────────
// Internal query — same as getByTask but without auth check, for sandbox
// orchestrator and other internal callers.

export const getByTaskInternal = internalQuery({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("taskDesignSnapshots")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId as any))
      .collect();

    if (snapshots.length === 0) return null;

    return snapshots[snapshots.length - 1];
  },
});
