import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

const analysisStatusValidator = v.union(
  v.literal("queued"),
  v.literal("extracting"),
  v.literal("analyzing"),
  v.literal("complete"),
  v.literal("failed"),
);

// ---------------------------------------------------------------------------
// 1. createAnalysis — internalMutation
// ---------------------------------------------------------------------------
export const createAnalysis = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("documentAnalyses", {
      orgId: args.orgId,
      programId: args.programId,
      documentId: args.documentId,
      status: "queued",
      analysisVersion: 1,
    });
    return analysisId;
  },
});

// ---------------------------------------------------------------------------
// 2. updateAnalysisStatus — internalMutation
// ---------------------------------------------------------------------------
export const updateAnalysisStatus = internalMutation({
  args: {
    analysisId: v.id("documentAnalyses"),
    status: analysisStatusValidator,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Analysis not found");

    await ctx.db.patch(args.analysisId, {
      status: args.status,
      ...(args.error !== undefined ? { error: args.error } : {}),
    });

    // Mirror status onto the parent document's analysisStatus field
    const doc = await ctx.db.get(analysis.documentId);
    if (doc) {
      // Map analysis status to document analysisStatus
      const docStatus =
        args.status === "queued"
          ? "queued"
          : args.status === "extracting" || args.status === "analyzing"
            ? "analyzing"
            : args.status === "complete"
              ? "complete"
              : "failed";
      await ctx.db.patch(analysis.documentId, {
        analysisStatus: docStatus,
        ...(docStatus === "failed" ? { analysisError: args.error } : { analysisError: undefined }),
      });
    }
  },
});

// ---------------------------------------------------------------------------
// 3. getById — internalQuery
// ---------------------------------------------------------------------------
export const getById = internalQuery({
  args: { analysisId: v.id("documentAnalyses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.analysisId);
  },
});

// ---------------------------------------------------------------------------
// 4. storeAnalysisResults — internalMutation
// ---------------------------------------------------------------------------
export const storeAnalysisResults = internalMutation({
  args: {
    analysisId: v.id("documentAnalyses"),
    findings: v.any(),
    claudeModelId: v.string(),
    claudeRequestId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheCreationTokens: v.number(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Analysis not found");

    await ctx.db.patch(args.analysisId, {
      status: "complete" as const,
      findings: args.findings,
      claudeModelId: args.claudeModelId,
      claudeRequestId: args.claudeRequestId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cacheReadTokens: args.cacheReadTokens,
      cacheCreationTokens: args.cacheCreationTokens,
      durationMs: args.durationMs,
    });

    // Update the parent document
    await ctx.db.patch(analysis.documentId, {
      analysisStatus: "complete" as const,
      latestAnalysisId: args.analysisId,
      analysisError: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// 7. createDiscoveryFindings — internalMutation
// ---------------------------------------------------------------------------
export const createDiscoveryFindings = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    analysisId: v.id("documentAnalyses"),
    documentId: v.id("documents"),
    findings: v.any(),
  },
  handler: async (ctx, args) => {
    const findings = args.findings as {
      requirements?: Array<{
        data: any;
        confidence: "high" | "medium" | "low";
        sourceExcerpt?: string;
        suggestedWorkstream?: string;
      }>;
      risks?: Array<{
        data: any;
        confidence: "high" | "medium" | "low";
        sourceExcerpt?: string;
        suggestedWorkstream?: string;
      }>;
      integrations?: Array<{
        data: any;
        confidence: "high" | "medium" | "low";
        sourceExcerpt?: string;
        suggestedWorkstream?: string;
      }>;
      decisions?: Array<{
        data: any;
        confidence: "high" | "medium" | "low";
        sourceExcerpt?: string;
        suggestedWorkstream?: string;
      }>;
    };

    const categories = [
      { key: "requirements", type: "requirement" as const },
      { key: "risks", type: "risk" as const },
      { key: "integrations", type: "integration" as const },
      { key: "decisions", type: "decision" as const },
    ] as const;

    for (const { key, type } of categories) {
      const items = findings?.[key];
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        await ctx.db.insert("discoveryFindings", {
          orgId: args.orgId,
          programId: args.programId,
          analysisId: args.analysisId,
          documentId: args.documentId,
          type,
          status: "pending",
          data: item.data,
          confidence: item.confidence ?? "medium",
          sourceExcerpt: item.sourceExcerpt,
          suggestedWorkstream: item.suggestedWorkstream,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// 9. getBatchProgress — query (reactive)
// ---------------------------------------------------------------------------
export const getBatchProgress = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const analyses = await ctx.db
      .query("documentAnalyses")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return await Promise.all(
      analyses.map(async (analysis) => {
        const doc = await ctx.db.get(analysis.documentId);
        return {
          documentId: analysis.documentId,
          analysisId: analysis._id,
          status: analysis.status,
          documentName: doc?.fileName ?? "Unknown",
        };
      }),
    );
  },
});

// ---------------------------------------------------------------------------
// 10. getByDocument — query
// ---------------------------------------------------------------------------
export const getByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError("Document not found");
    await assertOrgAccess(ctx, doc.orgId);

    const analyses = await ctx.db
      .query("documentAnalyses")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Return the most recent analysis (last inserted)
    return analyses.length > 0 ? analyses[analyses.length - 1] : null;
  },
});

// ---------------------------------------------------------------------------
// Internal helpers — used by actions to read documents/programs
// ---------------------------------------------------------------------------
export const getDocumentById = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

export const getProgramById = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.programId);
  },
});

// ---------------------------------------------------------------------------
// 11. logActivity — internalMutation
// ---------------------------------------------------------------------------
export const logActivity = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    analysisId: v.id("documentAnalyses"),
    step: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    level: v.union(v.literal("info"), v.literal("success"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analysisActivityLogs", {
      orgId: args.orgId,
      programId: args.programId,
      analysisId: args.analysisId,
      step: args.step,
      message: args.message,
      detail: args.detail,
      level: args.level,
    });
  },
});

// ---------------------------------------------------------------------------
// 12. getActivityLogs — query (reactive subscription target)
// ---------------------------------------------------------------------------
export const getActivityLogs = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("analysisActivityLogs")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});
