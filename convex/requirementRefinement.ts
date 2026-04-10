import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 1. storeRefinementSuggestions — internalMutation (patches placeholder with results)
// ---------------------------------------------------------------------------
export const storeRefinementSuggestions = internalMutation({
  args: {
    placeholderId: v.id("refinementSuggestions"),
    suggestions: v.any(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      suggestions: args.suggestions,
      status: "pending",
      totalTokensUsed: args.totalTokensUsed,
    });
  },
});

// ---------------------------------------------------------------------------
// 1b. markRefinementError — internalMutation
// ---------------------------------------------------------------------------
export const markRefinementError = internalMutation({
  args: {
    placeholderId: v.id("refinementSuggestions"),
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
// 2. getRefinementSuggestions — query (reactive)
// ---------------------------------------------------------------------------
export const getRefinementSuggestions = query({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const suggestions = await ctx.db
      .query("refinementSuggestions")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();

    // Return the most recent
    return suggestions.length > 0 ? suggestions[suggestions.length - 1] : null;
  },
});

// ---------------------------------------------------------------------------
// 3. applySuggestion — mutation
// ---------------------------------------------------------------------------
export const applySuggestion = mutation({
  args: {
    suggestionId: v.id("refinementSuggestions"),
    action: v.union(v.literal("accept"), v.literal("dismiss"), v.literal("split")),
    // For split: new requirement data
    splitRequirements: v.optional(
      v.array(
        v.object({
          title: v.string(),
          description: v.optional(v.string()),
          priority: v.union(
            v.literal("must_have"),
            v.literal("should_have"),
            v.literal("nice_to_have"),
            v.literal("deferred"),
          ),
          fitGap: v.union(
            v.literal("native"),
            v.literal("config"),
            v.literal("custom_dev"),
            v.literal("third_party"),
            v.literal("not_feasible"),
          ),
        }),
      ),
    ),
    // For accept: updated fields to apply to the requirement
    updatedTitle: v.optional(v.string()),
    updatedDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) throw new ConvexError("Suggestion not found");
    await assertOrgAccess(ctx, suggestion.orgId);

    const requirement = await ctx.db.get(suggestion.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");

    if (args.action === "accept") {
      // Apply suggested changes to the requirement
      const patch: Record<string, unknown> = {};
      if (args.updatedTitle) patch.title = args.updatedTitle;
      if (args.updatedDescription) patch.description = args.updatedDescription;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(suggestion.requirementId, patch);
      }

      await ctx.db.patch(args.suggestionId, { status: "applied" });

      await logAuditEvent(ctx, {
        orgId: suggestion.orgId,
        programId: suggestion.programId as string,
        entityType: "requirement",
        entityId: suggestion.requirementId as string,
        action: "update",
        description: `Applied AI refinement suggestion to "${requirement.title}"`,
      });
    } else if (args.action === "split" && args.splitRequirements) {
      // Create new requirements from the split
      const existing = await ctx.db
        .query("requirements")
        .withIndex("by_program", (q) => q.eq("programId", suggestion.programId))
        .collect();

      let nextNum = existing.length + 1;

      for (const splitReq of args.splitRequirements) {
        const refId = `REQ-${String(nextNum).padStart(3, "0")}`;
        await ctx.db.insert("requirements", {
          orgId: suggestion.orgId,
          programId: suggestion.programId,
          workstreamId: requirement.workstreamId,
          refId,
          title: splitReq.title,
          description: splitReq.description,
          priority: splitReq.priority,
          fitGap: splitReq.fitGap,
          status: "draft",
        });
        nextNum++;
      }

      // Mark original as deferred
      await ctx.db.patch(suggestion.requirementId, { status: "deferred" });
      await ctx.db.patch(args.suggestionId, { status: "applied" });

      await logAuditEvent(ctx, {
        orgId: suggestion.orgId,
        programId: suggestion.programId as string,
        entityType: "requirement",
        entityId: suggestion.requirementId as string,
        action: "update",
        description: `Split requirement "${requirement.title}" into ${args.splitRequirements.length} new requirements via AI suggestion`,
      });
    } else {
      // Dismiss
      await ctx.db.patch(args.suggestionId, { status: "dismissed" });
    }
  },
});

// ---------------------------------------------------------------------------
// 4. requestRefinement — public mutation (trigger)
// ---------------------------------------------------------------------------
export const requestRefinement = mutation({
  args: {
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    // Prevent duplicate processing
    const existing = await ctx.db
      .query("refinementSuggestions")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();
    const alreadyProcessing = existing.some((s) => s.status === "processing");
    if (alreadyProcessing) {
      throw new ConvexError("A refinement is already in progress for this requirement");
    }

    // Insert placeholder record
    const placeholderId = await ctx.db.insert("refinementSuggestions", {
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
      description: `Requested AI refinement for "${requirement.title}"`,
    });

    await ctx.scheduler.runAfter(0, internalApi.requirementRefinementActions.suggestRefinements, {
      orgId: requirement.orgId,
      requirementId: args.requirementId,
      programId: requirement.programId,
      placeholderId,
    });
  },
});
