import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";

/**
 * Public query: return cached model list for a provider.
 * Returns null when the cache is stale or missing (frontend shows fallback).
 */
export const listModels = query({
  args: {},
  handler: async (ctx) => {
    const cached = await ctx.db
      .query("aiModelCache")
      .withIndex("by_provider", (q) => q.eq("provider", "anthropic"))
      .unique();

    if (!cached || cached.expiresAt < Date.now()) return null;
    return cached.models;
  },
});

/** Internal query variant (callable from actions via internal reference). */
export const listModelsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cached = await ctx.db
      .query("aiModelCache")
      .withIndex("by_provider", (q) => q.eq("provider", "anthropic"))
      .unique();

    if (!cached || cached.expiresAt < Date.now()) return null;
    return cached.models;
  },
});

/** Upsert the model cache for a provider. Called by refreshModelCache action. */
export const upsertCache = internalMutation({
  args: {
    provider: v.string(),
    models: v.array(
      v.object({
        id: v.string(),
        displayName: v.string(),
      }),
    ),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiModelCache")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        models: args.models,
        fetchedAt: args.fetchedAt,
        expiresAt: args.expiresAt,
      });
    } else {
      await ctx.db.insert("aiModelCache", {
        provider: args.provider,
        models: args.models,
        fetchedAt: args.fetchedAt,
        expiresAt: args.expiresAt,
      });
    }
  },
});
