import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getWorkstreamQuery = internalQuery({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workstreamId);
  },
});

export const getRequirementQuery = internalQuery({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requirementId);
  },
});

export const getProgramQuery = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.programId);
  },
});

export const listWorkstreamsInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

export const listRequirementsByWorkstreamInternal = internalQuery({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("requirements")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();
  },
});
