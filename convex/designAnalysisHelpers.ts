import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ---------------------------------------------------------------------------
// Internal helpers for the design analysis pipeline.
// No "use node" — plain Convex runtime functions.
// ---------------------------------------------------------------------------

// Internal query to get asset (no auth check — internal only)
export const getAssetInternal = internalQuery({
  args: { assetId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.get(args.assetId as any);
  },
});

// Store analysis results
export const storeAnalysis = internalMutation({
  args: {
    designAssetId: v.string(),
    programId: v.string(),
    orgId: v.string(),
    structuredSpec: v.string(),
    markdownSummary: v.string(),
    extractedColors: v.array(v.object({ name: v.string(), hex: v.string(), usage: v.string() })),
    extractedTypography: v.array(
      v.object({
        role: v.string(),
        fontFamily: v.string(),
        fontSize: v.string(),
        fontWeight: v.string(),
        lineHeight: v.optional(v.string()),
      }),
    ),
    extractedComponents: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        description: v.string(),
        boundingBox: v.optional(
          v.object({
            x: v.number(),
            y: v.number(),
            width: v.number(),
            height: v.number(),
          }),
        ),
      }),
    ),
    extractedLayout: v.optional(
      v.object({
        type: v.string(),
        columns: v.optional(v.number()),
        spacing: v.optional(v.string()),
        responsive: v.optional(v.string()),
      }),
    ),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheCreationTokens: v.number(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("designAnalyses", {
      orgId: args.orgId,
      programId: args.programId as any,
      designAssetId: args.designAssetId as any,
      structuredSpec: args.structuredSpec,
      markdownSummary: args.markdownSummary,
      extractedColors: args.extractedColors,
      extractedTypography: args.extractedTypography,
      extractedComponents: args.extractedComponents,
      extractedLayout: args.extractedLayout,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cacheReadTokens: args.cacheReadTokens,
      cacheCreationTokens: args.cacheCreationTokens,
      durationMs: args.durationMs,
      analyzedAt: Date.now(),
    });
  },
});

// Store a design fidelity check result
export const storeFidelityCheck = internalMutation({
  args: {
    orgId: v.string(),
    taskId: v.string(),
    programId: v.string(),
    referenceImageId: v.string(),
    outputImageId: v.string(),
    structuralScore: v.number(),
    pixelScore: v.number(),
    overallScore: v.number(),
    deviations: v.array(
      v.object({
        area: v.string(),
        severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major")),
        description: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("designFidelityChecks", {
      orgId: args.orgId,
      taskId: args.taskId as any,
      programId: args.programId as any,
      referenceImageId: args.referenceImageId as any,
      outputImageId: args.outputImageId as any,
      structuralScore: args.structuralScore,
      pixelScore: args.pixelScore,
      overallScore: args.overallScore,
      deviations: args.deviations,
      checkedAt: Date.now(),
    });
  },
});

// Update asset status
export const updateAssetStatus = internalMutation({
  args: {
    assetId: v.string(),
    status: v.union(
      v.literal("uploaded"),
      v.literal("analyzing"),
      v.literal("analyzed"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.error) updates.analysisError = args.error;
    await ctx.db.patch(args.assetId as any, updates);
  },
});
