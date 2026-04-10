import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 1. storeDecomposition — internalMutation (patches placeholder with results)
// ---------------------------------------------------------------------------
export const storeDecomposition = internalMutation({
  args: {
    placeholderId: v.id("taskDecompositions"),
    decomposition: v.any(),
    thinkingTokens: v.number(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      decomposition: args.decomposition,
      status: "pending_review",
      thinkingTokens: args.thinkingTokens,
      totalTokensUsed: args.totalTokensUsed,
    });
  },
});

// ---------------------------------------------------------------------------
// 1b. markDecompositionError — internalMutation
// ---------------------------------------------------------------------------
export const markDecompositionError = internalMutation({
  args: {
    placeholderId: v.id("taskDecompositions"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      status: "error",
      error: args.error,
    });
  },
});

// ---------------------------------------------------------------------------
// 1c. appendDecomposedTask — internalMutation (streaming: append single task)
// ---------------------------------------------------------------------------
export const appendDecomposedTask = internalMutation({
  args: {
    placeholderId: v.id("taskDecompositions"),
    task: v.any(),
    taskIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.placeholderId);
    if (!record) return;

    const existing = (record.decomposition as any) ?? {};
    const tasks = existing.tasks ?? [];
    tasks.push(args.task);

    await ctx.db.patch(args.placeholderId, {
      decomposition: { ...existing, tasks },
      generationProgress: `Generated ${tasks.length} task${tasks.length !== 1 ? "s" : ""}...`,
    });
  },
});

// ---------------------------------------------------------------------------
// 1d. finalizeDecomposition — internalMutation (mark streaming complete)
// ---------------------------------------------------------------------------
export const finalizeDecomposition = internalMutation({
  args: {
    placeholderId: v.id("taskDecompositions"),
    decomposition: v.any(),
    thinkingTokens: v.number(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      decomposition: args.decomposition,
      status: "pending_review",
      thinkingTokens: args.thinkingTokens,
      totalTokensUsed: args.totalTokensUsed,
      generationProgress: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// 1e. updateDecompositionProgress — internalMutation (streaming progress text)
// ---------------------------------------------------------------------------
export const updateDecompositionProgress = internalMutation({
  args: {
    placeholderId: v.id("taskDecompositions"),
    progress: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      generationProgress: args.progress,
    });
  },
});

// ---------------------------------------------------------------------------
// 2. getLatestDecomposition — query (reactive)
// ---------------------------------------------------------------------------
export const getLatestDecomposition = query({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const decompositions = await ctx.db
      .query("taskDecompositions")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();

    return decompositions.length > 0 ? decompositions[decompositions.length - 1] : null;
  },
});

// ---------------------------------------------------------------------------
// 3. acceptDecomposition — mutation
// ---------------------------------------------------------------------------
export const acceptDecomposition = mutation({
  args: {
    decompositionId: v.id("taskDecompositions"),
  },
  handler: async (ctx, args) => {
    const decomposition = await ctx.db.get(args.decompositionId);
    if (!decomposition) throw new ConvexError("Decomposition not found");
    await assertOrgAccess(ctx, decomposition.orgId);

    const requirement = await ctx.db.get(decomposition.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");

    // Create actual tasks from decomposition
    const tasks = decomposition.decomposition as {
      tasks?: Array<{
        title: string;
        description?: string;
        priority?: "critical" | "high" | "medium" | "low";
        workstreamId?: string;
        dependencies?: number[];
        acceptance_criteria?: string[];
        story_points?: number;
      }>;
    };

    const createdTaskIds: string[] = [];

    if (tasks?.tasks) {
      for (const taskDef of tasks.tasks) {
        const taskId = await ctx.db.insert("tasks", {
          orgId: decomposition.orgId,
          programId: decomposition.programId,
          workstreamId: requirement.workstreamId,
          requirementId: decomposition.requirementId,
          title: taskDef.title,
          description: taskDef.description,
          acceptanceCriteria: taskDef.acceptance_criteria,
          storyPoints: taskDef.story_points,
          priority: taskDef.priority ?? "medium",
          status: "backlog",
        });
        createdTaskIds.push(taskId);
      }

      // Wire up dependencies after all tasks are created
      for (let i = 0; i < tasks.tasks.length; i++) {
        const taskDef = tasks.tasks[i];
        if (taskDef.dependencies && taskDef.dependencies.length > 0) {
          const blockedBy = taskDef.dependencies
            .filter((depIdx) => depIdx >= 0 && depIdx < createdTaskIds.length)
            .map((depIdx) => createdTaskIds[depIdx] as any);

          if (blockedBy.length > 0) {
            await ctx.db.patch(createdTaskIds[i] as any, { blockedBy });
          }
        }
      }
    }

    // Update decomposition status
    await ctx.db.patch(args.decompositionId, { status: "accepted" });

    // Update requirement status to in_progress
    if (requirement.status === "draft" || requirement.status === "approved") {
      await ctx.db.patch(decomposition.requirementId, {
        status: "in_progress",
      });
    }

    await logAuditEvent(ctx, {
      orgId: decomposition.orgId,
      programId: decomposition.programId as string,
      entityType: "requirement",
      entityId: decomposition.requirementId as string,
      action: "update",
      description: `Accepted AI task decomposition for "${requirement.title}" — created ${createdTaskIds.length} tasks`,
    });

    return createdTaskIds;
  },
});

// ---------------------------------------------------------------------------
// 4. rejectDecomposition — mutation
// ---------------------------------------------------------------------------
export const rejectDecomposition = mutation({
  args: {
    decompositionId: v.id("taskDecompositions"),
  },
  handler: async (ctx, args) => {
    const decomposition = await ctx.db.get(args.decompositionId);
    if (!decomposition) throw new ConvexError("Decomposition not found");
    await assertOrgAccess(ctx, decomposition.orgId);

    await ctx.db.patch(args.decompositionId, { status: "rejected" });
  },
});

// ---------------------------------------------------------------------------
// 5. requestDecomposition — public mutation (trigger)
// ---------------------------------------------------------------------------
export const requestDecomposition = mutation({
  args: {
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    // Prevent duplicate processing
    const existing = await ctx.db
      .query("taskDecompositions")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();
    const alreadyProcessing = existing.some((d) => d.status === "processing");
    if (alreadyProcessing) {
      throw new ConvexError("A task decomposition is already in progress for this requirement");
    }

    // Insert placeholder record
    const placeholderId = await ctx.db.insert("taskDecompositions", {
      orgId: requirement.orgId,
      requirementId: args.requirementId,
      programId: requirement.programId,
      status: "processing",
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      orgId: requirement.orgId,
      programId: requirement.programId as string,
      entityType: "requirement",
      entityId: args.requirementId as string,
      action: "create",
      description: `Requested AI task decomposition for "${requirement.title}"`,
    });

    await ctx.scheduler.runAfter(0, internalApi.taskDecompositionActions.suggestTaskDecomposition, {
      orgId: requirement.orgId,
      requirementId: args.requirementId,
      programId: requirement.programId,
      placeholderId,
    });
  },
});
