import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listByProgram = query({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("codebaseAnalyses")
      .withIndex("by_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis || analysis.orgId !== args.orgId) {
      throw new ConvexError("Analysis not found");
    }
    return analysis;
  },
});

export const getGraph = query({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const nodes = await ctx.db
      .query("codebaseGraphNodes")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
    const edges = await ctx.db
      .query("codebaseGraphEdges")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
    return { nodes, edges };
  },
});

export const getTours = query({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("codebaseTours")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
  },
});

export const getChatMessages = query({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("codebaseChatMessages")
      .withIndex("by_analysis_time", (q) => q.eq("analysisId", args.analysisId))
      .order("asc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    repositoryId: v.optional(v.id("repositories")),
    repoUrl: v.string(),
    repoName: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const now = Date.now();
    const analysisId = await ctx.db.insert("codebaseAnalyses", {
      orgId: args.orgId,
      programId: args.programId,
      repositoryId: args.repositoryId,
      repoUrl: args.repoUrl,
      repoName: args.repoName,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return analysisId;
  },
});

export const sendChatMessage = mutation({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis || analysis.orgId !== args.orgId) {
      throw new ConvexError("Analysis not found");
    }
    // Insert user message
    await ctx.db.insert("codebaseChatMessages", {
      orgId: args.orgId,
      analysisId: args.analysisId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });
    // Schedule the AI response
    await ctx.scheduler.runAfter(0, internal.codebaseAnalysisActions.generateChatResponse, {
      orgId: args.orgId,
      analysisId: args.analysisId,
      question: args.content,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal queries (called from actions)
// ---------------------------------------------------------------------------

export const listByProgramInternal = internalQuery({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("codebaseAnalyses")
      .withIndex("by_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .order("desc")
      .collect();
  },
});

export const getAnalysisInternal = internalQuery({
  args: { analysisId: v.id("codebaseAnalyses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.analysisId);
  },
});

export const getGraphInternal = internalQuery({
  args: { analysisId: v.id("codebaseAnalyses") },
  handler: async (ctx, args) => {
    const nodes = await ctx.db
      .query("codebaseGraphNodes")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
    const edges = await ctx.db
      .query("codebaseGraphEdges")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
    return { nodes, edges };
  },
});

export const getChatHistoryInternal = internalQuery({
  args: { analysisId: v.id("codebaseAnalyses") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("codebaseChatMessages")
      .withIndex("by_analysis_time", (q) => q.eq("analysisId", args.analysisId))
      .order("asc")
      .collect();
    return messages.map((m) => ({ role: m.role, content: m.content }));
  },
});

// ---------------------------------------------------------------------------
// Activity log query + mutation
// ---------------------------------------------------------------------------

export const getAnalysisLogs = query({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("codebaseAnalysisLogs")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
  },
});

export const logProgress = internalMutation({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    step: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    level: v.union(v.literal("info"), v.literal("success"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("codebaseAnalysisLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (called from actions)
// ---------------------------------------------------------------------------

export const updateStatus = internalMutation({
  args: {
    analysisId: v.id("codebaseAnalyses"),
    status: v.string(),
    currentStage: v.optional(v.string()),
    error: v.optional(v.string()),
    summary: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { analysisId, ...updates } = args;
    await ctx.db.patch(analysisId, {
      ...updates,
      updatedAt: Date.now(),
    } as any);
  },
});

export const storeGraphData = internalMutation({
  args: {
    analysisId: v.id("codebaseAnalyses"),
    orgId: v.string(),
    nodes: v.array(
      v.object({
        nodeType: v.string(),
        name: v.string(),
        filePath: v.string(),
        layer: v.string(),
        description: v.string(),
        language: v.string(),
        lineStart: v.optional(v.number()),
        lineEnd: v.optional(v.number()),
        metadata: v.optional(v.any()),
      }),
    ),
    edges: v.array(
      v.object({
        sourceIndex: v.number(),
        targetIndex: v.number(),
        edgeType: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Insert nodes and track their IDs by index
    const nodeIds: string[] = [];
    for (const node of args.nodes) {
      const id = await ctx.db.insert("codebaseGraphNodes", {
        orgId: args.orgId,
        analysisId: args.analysisId,
        nodeType: node.nodeType as any,
        name: node.name,
        filePath: node.filePath,
        layer: node.layer as any,
        description: node.description,
        language: node.language,
        lineStart: node.lineStart,
        lineEnd: node.lineEnd,
        metadata: node.metadata,
      });
      nodeIds.push(id);
    }
    // Insert edges referencing node IDs by index
    for (const edge of args.edges) {
      const sourceNodeId = nodeIds[edge.sourceIndex];
      const targetNodeId = nodeIds[edge.targetIndex];
      if (sourceNodeId && targetNodeId) {
        await ctx.db.insert("codebaseGraphEdges", {
          orgId: args.orgId,
          analysisId: args.analysisId,
          sourceNodeId: sourceNodeId as any,
          targetNodeId: targetNodeId as any,
          edgeType: edge.edgeType as any,
        });
      }
    }
    return nodeIds;
  },
});

export const storeTours = internalMutation({
  args: {
    analysisId: v.id("codebaseAnalyses"),
    orgId: v.string(),
    tours: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        steps: v.array(
          v.object({
            nodeIndex: v.number(),
            title: v.string(),
            explanation: v.string(),
            order: v.number(),
          }),
        ),
      }),
    ),
    nodeIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    for (const tour of args.tours) {
      await ctx.db.insert("codebaseTours", {
        orgId: args.orgId,
        analysisId: args.analysisId,
        title: tour.title,
        description: tour.description,
        steps: tour.steps.map((step) => ({
          nodeId: args.nodeIds[step.nodeIndex] as any,
          title: step.title,
          explanation: step.explanation,
          order: step.order,
        })),
      });
    }
  },
});

export const insertChatMessage = internalMutation({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    role: v.string(),
    content: v.string(),
    referencedNodes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("codebaseChatMessages", {
      orgId: args.orgId,
      analysisId: args.analysisId,
      role: args.role as any,
      content: args.content,
      referencedNodes: args.referencedNodes as any,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Entity Embeddings (Semantic Search)
// ---------------------------------------------------------------------------

export const storeEntities = internalMutation({
  args: {
    analysisId: v.id("codebaseAnalyses"),
    orgId: v.string(),
    programId: v.id("programs"),
    entities: v.array(
      v.object({
        entityType: v.string(),
        name: v.string(),
        filePath: v.string(),
        lineStart: v.number(),
        lineEnd: v.number(),
        signature: v.string(),
        docstring: v.optional(v.string()),
        bodyPreview: v.optional(v.string()),
        embedding: v.array(v.float64()),
        embeddingModel: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 50;
    for (let i = 0; i < args.entities.length; i += BATCH_SIZE) {
      const batch = args.entities.slice(i, i + BATCH_SIZE);
      for (const entity of batch) {
        await ctx.db.insert("codebaseEntityEmbeddings", {
          orgId: args.orgId,
          analysisId: args.analysisId,
          programId: args.programId,
          entityType: entity.entityType,
          name: entity.name,
          filePath: entity.filePath,
          lineStart: entity.lineStart,
          lineEnd: entity.lineEnd,
          signature: entity.signature,
          docstring: entity.docstring,
          bodyPreview: entity.bodyPreview,
          embedding: entity.embedding,
          embeddingModel: entity.embeddingModel,
        });
      }
    }
  },
});

export const getEntitiesByAnalysis = internalQuery({
  args: {
    analysisId: v.id("codebaseAnalyses"),
    entityTypeFilter: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.entityTypeFilter?.length) {
      // Fetch per entity type using the composite index
      const results = [];
      for (const entityType of args.entityTypeFilter) {
        const entities = await ctx.db
          .query("codebaseEntityEmbeddings")
          .withIndex("by_analysis_type", (q) =>
            q.eq("analysisId", args.analysisId).eq("entityType", entityType),
          )
          .collect();
        results.push(...entities);
      }
      return results;
    }
    return await ctx.db
      .query("codebaseEntityEmbeddings")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
  },
});
