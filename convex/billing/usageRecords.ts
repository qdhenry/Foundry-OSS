import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { aiUsageSourceValidator } from "./validators";

export const recordAiUsage = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.optional(v.id("programs")),
    source: aiUsageSourceValidator,
    claudeModelId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheCreationTokens: v.number(),
    costUsd: v.number(),
    durationMs: v.optional(v.number()),
    sourceEntityId: v.optional(v.string()),
    sourceEntityTable: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsageRecords", {
      ...args,
      recordedAt: Date.now(),
    });
  },
});
