"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";

const RETENTION_CLEANUP_BATCH_SIZE = 200;
const internalApi: any = (generatedApi as any).internal;

async function getAnalysis(ctx: ActionCtx, analysisId: Id<"videoAnalyses">) {
  const analysis = await ctx.runQuery(internalApi.videoAnalysis.getById, { analysisId });
  if (!analysis) throw new ConvexError("Video analysis not found");
  return analysis;
}

async function logActivity(
  ctx: ActionCtx,
  args: {
    orgId: string;
    programId: Id<"programs">;
    analysisId: Id<"videoAnalyses">;
    step: string;
    message: string;
    level: "info" | "success" | "error";
    detail?: string;
  },
) {
  await ctx.runMutation(internalApi.videoAnalysis.logActivity, {
    orgId: args.orgId,
    programId: args.programId,
    analysisId: args.analysisId,
    step: args.step,
    message: args.message,
    detail: args.detail,
    level: args.level,
  });
}

export const persistSegmentOutputs = internalAction({
  args: {
    analysisId: v.id("videoAnalyses"),
    segmentOutputs: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const analysis = await getAnalysis(ctx, args.analysisId);

    const persisted = await ctx.runMutation(internalApi.videoAnalysis.persistSegmentOutputs, {
      analysisId: args.analysisId,
      segmentOutputs: args.segmentOutputs,
    });

    await logActivity(ctx, {
      orgId: analysis.orgId,
      programId: analysis.programId,
      analysisId: args.analysisId,
      step: "segment_outputs_persisted",
      message: `Persisted ${persisted.segmentCount} segment outputs (${persisted.insertedVideoFindings} video findings, ${persisted.mirroredDiscoveryFindings} mirrored findings).`,
      level: "success",
    });
  },
});

export const persistSynthesisOutputs = internalAction({
  args: {
    analysisId: v.id("videoAnalyses"),
    synthesisOutput: v.any(),
    totalTokensUsed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const analysis = await getAnalysis(ctx, args.analysisId);

    await ctx.runMutation(internalApi.videoAnalysis.updateStatus, {
      analysisId: args.analysisId,
      status: "analyzing",
      failedStage: undefined,
      failedError: undefined,
    });

    const persisted = await ctx.runMutation(internalApi.videoAnalysis.persistSynthesisOutputs, {
      analysisId: args.analysisId,
      synthesisOutput: args.synthesisOutput,
    });

    await ctx.runMutation(internalApi.videoAnalysis.updateStatus, {
      analysisId: args.analysisId,
      status: "complete",
      totalTokensUsed: args.totalTokensUsed,
      durationMs: args.durationMs,
      failedStage: undefined,
      failedError: undefined,
    });

    await logActivity(ctx, {
      orgId: analysis.orgId,
      programId: analysis.programId,
      analysisId: args.analysisId,
      step: "synthesis_outputs_persisted",
      message: `Persisted synthesis outputs (${persisted.insertedVideoFindings} video findings, ${persisted.mirroredDiscoveryFindings} mirrored findings).`,
      level: "success",
    });
  },
});

export const runRetentionCleanup = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scanned: number; marked: number; skipped: number }> => {
    const now = Date.now();
    const candidates: Array<{
      _id: Id<"videoAnalyses">;
      orgId: string;
      programId: Id<"programs">;
    }> = await ctx.runQuery(internalApi.videoAnalysis.getRetentionCleanupCandidates, {
      now,
      limit: RETENTION_CLEANUP_BATCH_SIZE,
    });

    let marked = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      try {
        const result = await ctx.runMutation(internalApi.videoAnalysis.markRetentionExpired, {
          analysisId: candidate._id,
          now,
        });

        if (!result.marked) {
          skipped += 1;
          continue;
        }

        marked += 1;

        await ctx.runMutation(internalApi.videoAnalysis.logActivity, {
          orgId: candidate.orgId,
          programId: candidate.programId,
          analysisId: candidate._id,
          step: "retention_expired",
          message:
            "Retention period expired; analysis raw assets marked as expired (non-destructive cleanup).",
          level: "info",
        });
      } catch (error) {
        skipped += 1;
        console.error(`[video-retention-cleanup] failed for analysis ${candidate._id}:`, error);
      }
    }

    return {
      scanned: candidates.length,
      marked,
      skipped,
    };
  },
});
