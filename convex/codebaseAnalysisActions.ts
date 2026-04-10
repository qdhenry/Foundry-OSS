"use node";

import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { callAgentService } from "./lib/agentServiceClient";
import { getProvider } from "./sourceControl/factory";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// Actions (orchestration — calls agent service)
// ---------------------------------------------------------------------------

export const runAnalysis = action({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    repoUrl: v.string(),
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = (step: string, message: string, level: "info" | "success" | "error" = "info") =>
      ctx.runMutation(internal.codebaseAnalysis.logProgress, {
        orgId: args.orgId,
        analysisId: args.analysisId,
        step,
        message,
        level,
      });

    try {
      // Resolve access token: use provided token, or look up installation token for linked repos
      let resolvedAccessToken = args.accessToken;
      if (!resolvedAccessToken) {
        const repoMatch = args.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
        if (repoMatch) {
          const repoFullName = repoMatch[1].replace(/\.git$/, "");
          const linkedRepo = await ctx.runQuery(
            internal.sourceControl.repositories.getByFullNameInternal,
            { repoFullName, orgId: args.orgId },
          );
          if (linkedRepo) {
            const provider = getProvider(linkedRepo.providerType as any);
            const tokenResult = await provider.getInstallationToken(linkedRepo.installationId);
            resolvedAccessToken = tokenResult.token;
          }
        }
      }

      // Stage 1: Scanning
      await log("start", "Starting analysis...");
      await ctx.runMutation(internal.codebaseAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "scanning",
        currentStage: "Project scanning — discovering files, languages, frameworks",
      });
      await log("scanning", "Scanning repository — fetching file tree and source files...");
      await log(
        "calling_ai",
        "Calling Claude API — analyzing architecture with extended thinking...",
      );

      const scanResult = await callAgentService<{
        analysis: {
          nodes: Array<{
            nodeType: string;
            name: string;
            filePath: string;
            layer: string;
            description: string;
            language: string;
            lineStart?: number;
            lineEnd?: number;
            metadata?: any;
          }>;
          edges: Array<{
            sourceIndex: number;
            targetIndex: number;
            edgeType: string;
          }>;
          summary: {
            totalFiles: number;
            totalFunctions: number;
            totalClasses: number;
            languages: string[];
            frameworks: string[];
            layerBreakdown: Array<{ layer: string; count: number }>;
          };
          tours: Array<{
            title: string;
            description: string;
            steps: Array<{
              nodeIndex: number;
              title: string;
              explanation: string;
              order: number;
            }>;
          }>;
          entities?: Array<{
            type?: string;
            entityType?: string;
            name: string;
            filePath: string;
            lineStart: number;
            lineEnd: number;
            signature: string;
            docstring?: string;
            bodyPreview?: string;
            embedding: number[];
            embeddingModel?: string;
          }>;
        };
        metadata: {
          totalTokensUsed: number;
          inputTokens: number;
          outputTokens: number;
          processedAt: string;
        };
      }>({
        endpoint: "/analyze-codebase",
        body: {
          repoUrl: args.repoUrl,
          accessToken: resolvedAccessToken,
        },
        orgId: args.orgId,
        timeoutMs: 300_000, // 5 minutes for large repos
      });

      const { nodes, edges, tours, summary } = scanResult.analysis;
      const meta = scanResult.metadata as any;
      await log(
        "ai_complete",
        `AI analysis complete — ${nodes.length} nodes, ${edges.length} edges${meta?.fileCount ? ` from ${meta.fileCount} files (${meta.sampledFileCount} sampled)` : ""}`,
      );

      // Stage 2: Storing graph
      await ctx.runMutation(internal.codebaseAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "analyzing",
        currentStage: "Storing knowledge graph nodes and edges",
      });
      await log(
        "store_graph",
        `Storing knowledge graph — ${nodes.length} nodes, ${edges.length} edges...`,
      );

      const nodeIds = await ctx.runMutation(internal.codebaseAnalysis.storeGraphData, {
        analysisId: args.analysisId,
        orgId: args.orgId,
        nodes,
        edges,
      });
      await log("graph_stored", "Knowledge graph stored successfully");

      // Stage 3: Storing tours
      if (tours.length > 0) {
        await ctx.runMutation(internal.codebaseAnalysis.updateStatus, {
          analysisId: args.analysisId,
          status: "touring",
          currentStage: "Generating architecture tours",
        });
        await log(
          "store_tours",
          `Generating ${tours.length} architecture tour${tours.length > 1 ? "s" : ""}...`,
        );

        await ctx.runMutation(internal.codebaseAnalysis.storeTours, {
          analysisId: args.analysisId,
          orgId: args.orgId,
          tours,
          nodeIds,
        });
      }

      // Stage 4: Store entity embeddings (if AST extraction was performed)
      const entities = scanResult.analysis.entities;
      if (entities && entities.length > 0) {
        await log("store_entities", `Storing ${entities.length} code entities with embeddings...`);
        const analysisForProgram = await ctx.runQuery(
          internalApi.codebaseAnalysis.getAnalysisInternal,
          { analysisId: args.analysisId },
        );
        if (analysisForProgram?.programId) {
          await ctx.runMutation(internal.codebaseAnalysis.storeEntities, {
            analysisId: args.analysisId,
            orgId: args.orgId,
            programId: analysisForProgram.programId,
            entities: entities.map((e) => ({
              entityType: e.entityType || e.type || "unknown",
              name: e.name,
              filePath: e.filePath,
              lineStart: e.lineStart,
              lineEnd: e.lineEnd,
              signature: e.signature,
              docstring: e.docstring ?? undefined,
              bodyPreview: e.bodyPreview ?? undefined,
              embedding: e.embedding,
              embeddingModel: e.embeddingModel || "Xenova/bge-small-en-v1.5",
            })),
          });
          await log("entities_stored", `${entities.length} entities stored for semantic search`);
        }
      }

      // Complete
      await ctx.runMutation(internal.codebaseAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "completed",
        currentStage: undefined,
        summary,
      });
      const langs = summary.languages?.join(", ") || "unknown";
      await log(
        "complete",
        `Analysis complete — ${summary.totalFiles ?? nodes.length} files, ${langs}`,
        "success",
      );

      // Best-effort execution logging
      try {
        const tokensUsed =
          (meta?.totalTokensUsed ?? 0) || (meta?.inputTokens ?? 0) + (meta?.outputTokens ?? 0);
        const analysisRecord = await ctx.runQuery(
          internalApi.codebaseAnalysis.getAnalysisInternal,
          { analysisId: args.analysisId },
        );
        if (analysisRecord?.programId) {
          await ctx.runMutation(internalApi.ai.logExecution, {
            orgId: args.orgId,
            programId: analysisRecord.programId,
            executionMode: "platform" as const,
            trigger: "manual" as const,
            taskType: "codebase_analysis",
            inputSummary: `Repo: ${args.repoUrl}`,
            outputSummary: `${nodes.length} nodes, ${edges.length} edges, langs: ${langs}`,
            tokensUsed,
            modelId: "claude-sonnet-4-5-20250929",
          });
        }
      } catch {
        /* best-effort */
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await log("error", `Analysis failed: ${msg}`, "error").catch(() => {});
      await ctx.runMutation(internal.codebaseAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "failed",
        error: msg,
      });
      throw error;
    }
  },
});

export const generateChatResponse = action({
  args: {
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const graphContext = await ctx.runQuery(internal.codebaseAnalysis.getGraphInternal, {
        analysisId: args.analysisId,
      });
      const chatHistory = await ctx.runQuery(internal.codebaseAnalysis.getChatHistoryInternal, {
        analysisId: args.analysisId,
      });

      const result = await callAgentService<{
        answer: string;
        referencedNodeNames: string[];
        metadata: {
          totalTokensUsed: number;
          inputTokens: number;
          outputTokens: number;
          processedAt: string;
        };
      }>({
        endpoint: "/codebase-chat",
        body: {
          question: args.question,
          graphContext,
          chatHistory,
        },
        orgId: args.orgId,
      });

      await ctx.runMutation(internal.codebaseAnalysis.insertChatMessage, {
        orgId: args.orgId,
        analysisId: args.analysisId,
        role: "assistant",
        content: result.answer,
      });
    } catch (error) {
      await ctx.runMutation(internal.codebaseAnalysis.insertChatMessage, {
        orgId: args.orgId,
        analysisId: args.analysisId,
        role: "assistant",
        content: `Error generating response: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Semantic Search
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export const semanticSearch = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    queryText: v.string(),
    limit: v.optional(v.number()),
    entityTypeFilter: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      _id: string;
      entityType: string;
      name: string;
      filePath: string;
      lineStart: number;
      lineEnd: number;
      signature: string;
      docstring: string;
      bodyPreview: string;
      similarity: number;
    }>
  > => {
    // 1. Embed query text via agent-service /embed endpoint
    const embedResult = await callAgentService<{ embedding: number[] }>({
      endpoint: "/embed",
      body: { text: args.queryText },
      orgId: args.orgId,
      timeoutMs: 30_000,
    });
    const queryEmbedding = embedResult.embedding;

    // 2. Get latest analysis for this program
    const analyses: any[] = await ctx.runQuery(internal.codebaseAnalysis.listByProgramInternal, {
      orgId: args.orgId,
      programId: args.programId,
    });
    if (!analyses.length) return [];
    const latestAnalysis = analyses[0];

    // 3. Fetch all entity embeddings for latest analysis
    const entities: any[] = await ctx.runQuery(internal.codebaseAnalysis.getEntitiesByAnalysis, {
      analysisId: latestAnalysis._id,
      entityTypeFilter: args.entityTypeFilter,
    });
    if (!entities.length) return [];

    // 4. Compute cosine similarity for each entity
    const scored = entities.map((e: any) => ({
      _id: e._id,
      entityType: e.entityType,
      name: e.name,
      filePath: e.filePath,
      lineStart: e.lineStart,
      lineEnd: e.lineEnd,
      signature: e.signature,
      docstring: e.docstring,
      bodyPreview: e.bodyPreview,
      similarity: cosineSimilarity(queryEmbedding, e.embedding),
    }));

    // 5. BM25-style boost: 1.5x for entities whose name matches query keywords
    const queryTokens = args.queryText.toLowerCase().split(/\s+/);
    for (const item of scored) {
      const nameLower = item.name.toLowerCase();
      if (queryTokens.some((t) => nameLower.includes(t))) {
        item.similarity *= 1.5;
      }
    }

    // 6. Return top-K results sorted by similarity
    return scored
      .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
      .slice(0, args.limit ?? 20);
  },
});
