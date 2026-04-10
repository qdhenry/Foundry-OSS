import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import type {
  FindingNormalizationDefaults,
  NormalizedFinding,
} from "./lib/videoFindingNormalization";
import {
  asRecord,
  collectFindingsFromOutput,
  extractKeyframeUrls,
  findingSignature,
  normalizeSpeaker,
} from "./lib/videoFindingNormalization";
import { evaluateRetentionCandidate, resolveRetentionExpiresAt } from "./lib/videoRetention";
import { assertOrgAccess } from "./model/access";
import type { VideoRetentionPolicy } from "./shared/videoContracts";
import {
  videoAnalysisStatusValidator,
  videoRetentionPolicyValidator,
} from "./shared/videoContracts";

function stageTimestampPatch(status: string): Record<string, number> {
  const now = Date.now();

  if (status === "uploading") return { uploadingAt: now };
  if (status === "indexing") return { indexingAt: now };
  if (status === "analyzing") return { analyzingAt: now };
  if (status === "complete") return { completedAt: now };
  if (status === "failed") return { failedAt: now };

  return {};
}

async function mirrorReviewReadyDiscoveryFinding(
  ctx: MutationCtx,
  args: {
    orgId: string;
    programId: Id<"programs">;
    documentId: Id<"documents">;
    videoAnalysisId: Id<"videoAnalyses">;
    normalizedFinding: NormalizedFinding;
    existingDiscoverySignatures: Set<string>;
  },
) {
  if (!args.normalizedFinding.reviewReady) return;

  const signature = findingSignature({
    type: args.normalizedFinding.type,
    segmentIndex: args.normalizedFinding.segmentIndex,
    sourceTimestamp: args.normalizedFinding.sourceAttribution.sourceTimestamp,
    sourceTimestampEnd: args.normalizedFinding.sourceAttribution.sourceTimestampEnd,
    sourceExcerpt: args.normalizedFinding.sourceAttribution.sourceExcerpt,
    synthesisNote: args.normalizedFinding.synthesisNote,
  });
  if (args.existingDiscoverySignatures.has(signature)) return;

  await ctx.db.insert("discoveryFindings", {
    orgId: args.orgId,
    programId: args.programId,
    analysisId: args.videoAnalysisId,
    documentId: args.documentId,
    type: args.normalizedFinding.type,
    status: "pending",
    data: args.normalizedFinding.data,
    confidence: args.normalizedFinding.confidence,
    sourceExcerpt: args.normalizedFinding.sourceAttribution.sourceExcerpt,
    sourceAttribution: args.normalizedFinding.sourceAttribution,
    suggestedWorkstream: args.normalizedFinding.suggestedWorkstream,
  });
  args.existingDiscoverySignatures.add(signature);
}

async function insertVideoAnalysis(
  ctx: MutationCtx,
  args: {
    orgId: string;
    programId: Id<"programs">;
    documentId: Id<"documents">;
    videoUrl: string;
    videoSizeBytes: number;
    mimeType: string;
    videoDurationMs?: number;
    retentionPolicy?: VideoRetentionPolicy;
  },
) {
  const retentionPolicy = args.retentionPolicy ?? "90_days";
  const retentionExpiresAt = resolveRetentionExpiresAt(retentionPolicy);

  return await ctx.db.insert("videoAnalyses", {
    orgId: args.orgId,
    programId: args.programId,
    documentId: args.documentId,
    status: "uploading",
    videoUrl: args.videoUrl,
    videoSizeBytes: args.videoSizeBytes,
    videoDurationMs: args.videoDurationMs,
    mimeType: args.mimeType,
    speakerMappingComplete: true,
    retentionPolicy,
    retentionExpiresAt,
    retentionStatus: "active",
    analysisVersion: 1,
    retryCount: 0,
    stageTimestamps: {
      ...stageTimestampPatch("uploading"),
    },
  });
}

type RetentionCleanupCandidate = {
  _id: Id<"videoAnalyses">;
  orgId: string;
  programId: Id<"programs">;
  retentionExpiresAt?: number;
  retentionStatus?: "active" | "expired";
  retentionCleanupAt?: number;
  transcriptId?: Id<"videoTranscripts">;
  frameExtractionId?: Id<"videoFrameExtractions">;
};

// Internal creation path for workers/actions and upload-confirmation bootstrap.
export const createAnalysis = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    documentId: v.id("documents"),
    videoUrl: v.string(),
    videoSizeBytes: v.number(),
    mimeType: v.string(),
    videoDurationMs: v.optional(v.number()),
    retentionPolicy: v.optional(videoRetentionPolicyValidator),
  },
  handler: async (ctx, args) => {
    return await insertVideoAnalysis(ctx, args);
  },
});

// Internal status API for pipeline workers.
export const updateStatus = internalMutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    status: videoAnalysisStatusValidator,
    failedStage: v.optional(v.string()),
    failedError: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    totalTokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    const existingTimestamps = analysis.stageTimestamps ?? {};
    const nextTimestamps = {
      ...existingTimestamps,
      ...stageTimestampPatch(args.status),
    };

    const patch: Record<string, unknown> = {
      status: args.status,
      stageTimestamps: nextTimestamps,
    };
    if (args.durationMs !== undefined) patch.durationMs = args.durationMs;
    if (args.totalTokensUsed !== undefined) patch.totalTokensUsed = args.totalTokensUsed;

    if (args.failedStage !== undefined) {
      patch.failedStage = args.failedStage;
    }

    if (args.failedError !== undefined) {
      patch.failedError = args.failedError;
    }

    if (args.retryCount !== undefined) {
      patch.retryCount = args.retryCount;
    }

    await ctx.db.patch(args.analysisId, patch);
  },
});

async function persistFindings(
  ctx: MutationCtx,
  args: {
    analysis: {
      _id: Id<"videoAnalyses">;
      orgId: string;
      programId: Id<"programs">;
      documentId: Id<"documents">;
    };
    normalizedFindings: NormalizedFinding[];
  },
) {
  const existingVideoFindings = await ctx.db
    .query("videoFindings")
    .withIndex("by_video_analysis", (q) => q.eq("videoAnalysisId", args.analysis._id))
    .collect();
  const existingVideoFindingSignatures = new Set(
    existingVideoFindings.map((finding) =>
      findingSignature({
        type: finding.type,
        segmentIndex: finding.segmentIndex,
        sourceTimestamp: finding.sourceTimestamp,
        sourceTimestampEnd: finding.sourceTimestampEnd,
        sourceExcerpt: finding.sourceExcerpt,
        synthesisNote: finding.synthesisNote,
      }),
    ),
  );

  const existingDiscoveryFindings = await ctx.db
    .query("discoveryFindings")
    .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysis._id))
    .collect();
  const existingDiscoverySignatures = new Set(
    existingDiscoveryFindings
      .map((finding) => {
        const attribution = finding.sourceAttribution as Record<string, unknown> | undefined;
        if (!attribution || typeof attribution.sourceTimestamp !== "number") return null;
        return findingSignature({
          type: finding.type,
          sourceTimestamp: attribution.sourceTimestamp,
          sourceTimestampEnd:
            typeof attribution.sourceTimestampEnd === "number"
              ? attribution.sourceTimestampEnd
              : undefined,
          sourceExcerpt:
            typeof attribution.sourceExcerpt === "string"
              ? attribution.sourceExcerpt
              : (finding.sourceExcerpt ?? "Excerpt unavailable"),
        });
      })
      .filter((signature): signature is string => signature !== null),
  );

  let insertedVideoFindings = 0;
  let mirroredDiscoveryFindings = 0;

  for (const finding of args.normalizedFindings) {
    const signature = findingSignature({
      type: finding.type,
      segmentIndex: finding.segmentIndex,
      sourceTimestamp: finding.sourceAttribution.sourceTimestamp,
      sourceTimestampEnd: finding.sourceAttribution.sourceTimestampEnd,
      sourceExcerpt: finding.sourceAttribution.sourceExcerpt,
      synthesisNote: finding.synthesisNote,
    });
    if (existingVideoFindingSignatures.has(signature)) {
      continue;
    }

    await ctx.db.insert("videoFindings", {
      orgId: args.analysis.orgId,
      programId: args.analysis.programId,
      videoAnalysisId: args.analysis._id,
      documentId: args.analysis.documentId,
      type: finding.type,
      status: finding.status,
      data: finding.data,
      sourceTimestamp: finding.sourceAttribution.sourceTimestamp,
      sourceTimestampEnd: finding.sourceAttribution.sourceTimestampEnd,
      sourceExcerpt: finding.sourceAttribution.sourceExcerpt,
      sourceSpeaker: finding.sourceAttribution.sourceSpeaker,
      sourceKeyframeUrls: finding.sourceAttribution.sourceKeyframeUrls,
      sourceAttribution: finding.sourceAttribution,
      confidence: finding.confidence,
      segmentIndex: finding.segmentIndex,
      synthesisNote: finding.synthesisNote,
      suggestedWorkstream: finding.suggestedWorkstream,
    });
    existingVideoFindingSignatures.add(signature);
    insertedVideoFindings += 1;

    const discoveryCountBefore = existingDiscoverySignatures.size;
    await mirrorReviewReadyDiscoveryFinding(ctx, {
      orgId: args.analysis.orgId,
      programId: args.analysis.programId,
      documentId: args.analysis.documentId,
      videoAnalysisId: args.analysis._id,
      normalizedFinding: finding,
      existingDiscoverySignatures,
    });
    if (existingDiscoverySignatures.size > discoveryCountBefore) {
      mirroredDiscoveryFindings += 1;
    }
  }

  return { insertedVideoFindings, mirroredDiscoveryFindings };
}

export const persistSegmentOutputs = internalMutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    segmentOutputs: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    const normalizedFindings: NormalizedFinding[] = [];
    for (let index = 0; index < args.segmentOutputs.length; index += 1) {
      const segmentOutput = asRecord(args.segmentOutputs[index]);
      if (!segmentOutput) continue;

      const segmentIndex =
        typeof segmentOutput.segmentIndex === "number" ? segmentOutput.segmentIndex : index;
      const defaults: FindingNormalizationDefaults = {
        segmentIndex,
        sourceTimestamp:
          typeof segmentOutput.startMs === "number" ? segmentOutput.startMs : undefined,
        sourceTimestampEnd:
          typeof segmentOutput.endMs === "number" ? segmentOutput.endMs : undefined,
        sourceExcerpt:
          typeof segmentOutput.summary === "string" ? segmentOutput.summary : undefined,
        sourceSpeaker:
          normalizeSpeaker(segmentOutput.sourceSpeaker) ??
          normalizeSpeaker(segmentOutput.primarySpeaker) ??
          normalizeSpeaker(segmentOutput.speaker),
        sourceKeyframeUrls:
          extractKeyframeUrls(segmentOutput.sourceKeyframeUrls) ??
          extractKeyframeUrls(segmentOutput.keyframeUrls) ??
          extractKeyframeUrls(segmentOutput),
      };
      normalizedFindings.push(...collectFindingsFromOutput(segmentOutput, defaults));
    }

    const result = await persistFindings(ctx, {
      analysis: {
        _id: analysis._id,
        orgId: analysis.orgId,
        programId: analysis.programId,
        documentId: analysis.documentId,
      },
      normalizedFindings,
    });

    await ctx.db.patch(args.analysisId, {
      segmentOutputs: args.segmentOutputs,
    });

    return {
      segmentCount: args.segmentOutputs.length,
      insertedVideoFindings: result.insertedVideoFindings,
      mirroredDiscoveryFindings: result.mirroredDiscoveryFindings,
    };
  },
});

export const persistSynthesisOutputs = internalMutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    synthesisOutput: v.any(),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    const synthesisOutput = asRecord(args.synthesisOutput);
    const normalizedFindings = collectFindingsFromOutput(args.synthesisOutput, {
      sourceTimestamp:
        typeof synthesisOutput?.sourceTimestamp === "number" ? synthesisOutput.sourceTimestamp : 0,
      sourceTimestampEnd:
        typeof synthesisOutput?.sourceTimestampEnd === "number"
          ? synthesisOutput.sourceTimestampEnd
          : undefined,
      sourceExcerpt:
        typeof synthesisOutput?.summary === "string"
          ? synthesisOutput.summary
          : "Synthesis finding",
      sourceSpeaker: normalizeSpeaker(synthesisOutput?.sourceSpeaker),
      sourceKeyframeUrls:
        extractKeyframeUrls(synthesisOutput?.sourceKeyframeUrls) ??
        extractKeyframeUrls(synthesisOutput?.keyframeUrls) ??
        extractKeyframeUrls(synthesisOutput),
      synthesisNote:
        typeof synthesisOutput?.summary === "string" ? synthesisOutput.summary : undefined,
    });

    const result = await persistFindings(ctx, {
      analysis: {
        _id: analysis._id,
        orgId: analysis.orgId,
        programId: analysis.programId,
        documentId: analysis.documentId,
      },
      normalizedFindings,
    });

    await ctx.db.patch(args.analysisId, {
      synthesisOutput: args.synthesisOutput,
    });

    return {
      insertedVideoFindings: result.insertedVideoFindings,
      mirroredDiscoveryFindings: result.mirroredDiscoveryFindings,
    };
  },
});

// Public read API: fetch video findings for a completed analysis.
export const getVideoFindingsByAnalysis = query({
  args: { analysisId: v.id("videoAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");
    await assertOrgAccess(ctx, analysis.orgId);
    return await ctx.db
      .query("videoFindings")
      .withIndex("by_video_analysis", (q) => q.eq("videoAnalysisId", args.analysisId))
      .collect();
  },
});

// Public read API: fetch one analysis with org-scoped access control.
export const get = query({
  args: { analysisId: v.id("videoAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    await assertOrgAccess(ctx, analysis.orgId);
    return analysis;
  },
});

// Public read API: lightweight status endpoint for polling.
export const getStatus = query({
  args: { analysisId: v.id("videoAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    await assertOrgAccess(ctx, analysis.orgId);

    return {
      analysisId: analysis._id,
      status: analysis.status,
      failedStage: analysis.failedStage,
      failedError: analysis.failedError,
      retryCount: analysis.retryCount,
      stageTimestamps: analysis.stageTimestamps,
    };
  },
});

// Public read API: latest analysis by document.
export const getByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new ConvexError("Document not found");

    await assertOrgAccess(ctx, document.orgId);

    return await ctx.db
      .query("videoAnalyses")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();
  },
});

// Public read API: list analyses in a program, optionally filtered by status.
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    status: v.optional(videoAnalysisStatusValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");

    await assertOrgAccess(ctx, program.orgId);

    if (args.status !== undefined) {
      return await ctx.db
        .query("videoAnalyses")
        .withIndex("by_status", (q) => q.eq("programId", args.programId).eq("status", args.status!))
        .take(50);
    }

    return await ctx.db
      .query("videoAnalyses")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .take(50);
  },
});

// Internal activity API for pipeline workers.
export const logActivity = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    analysisId: v.id("videoAnalyses"),
    step: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    level: v.union(v.literal("info"), v.literal("success"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("videoActivityLogs", {
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

export const getRetentionCleanupCandidates = internalQuery({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RetentionCleanupCandidate[]> => {
    const limit = Math.max(1, Math.min(args.limit ?? 200, 1000));

    const analyses = await ctx.db
      .query("videoAnalyses")
      .withIndex("by_retention", (q) => q.lte("retentionExpiresAt", args.now))
      .collect();

    const eligible = analyses
      .filter(
        (analysis) =>
          evaluateRetentionCandidate(
            {
              retentionExpiresAt: analysis.retentionExpiresAt,
              retentionStatus: analysis.retentionStatus,
              retentionCleanupAt: analysis.retentionCleanupAt,
            },
            args.now,
          ).eligible,
      )
      .slice(0, limit);

    return eligible.map((analysis) => ({
      _id: analysis._id,
      orgId: analysis.orgId,
      programId: analysis.programId,
      retentionExpiresAt: analysis.retentionExpiresAt,
      retentionStatus: analysis.retentionStatus,
      retentionCleanupAt: analysis.retentionCleanupAt,
      transcriptId: analysis.transcriptId,
      frameExtractionId: analysis.frameExtractionId,
    }));
  },
});

export const markRetentionExpired = internalMutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    const decision = evaluateRetentionCandidate(
      {
        retentionExpiresAt: analysis.retentionExpiresAt,
        retentionStatus: analysis.retentionStatus,
        retentionCleanupAt: analysis.retentionCleanupAt,
      },
      args.now,
    );

    if (!decision.eligible) {
      return {
        marked: false,
        reason: decision.reason,
      };
    }

    await ctx.db.patch(args.analysisId, {
      retentionStatus: "expired",
      retentionCleanupAt: args.now,
      retentionMetadata: {
        rawAssetState: "expired",
        lastCleanupReason: "retention_expired",
      },
    });

    if (analysis.transcriptId) {
      await ctx.db.patch(analysis.transcriptId, {
        retentionExpiredAt: args.now,
      });
    }

    if (analysis.frameExtractionId) {
      await ctx.db.patch(analysis.frameExtractionId, {
        retentionExpiredAt: args.now,
      });
    }

    return {
      marked: true,
      reason: decision.reason,
    };
  },
});

// Program-scoped read API for reactive activity subscriptions.
export const getActivityLogs = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");

    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("videoActivityLogs")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(100);
  },
});

// Analysis-scoped read API for reactive activity subscriptions on the detail page.
export const getActivityLogsByAnalysis = query({
  args: { analysisId: v.id("videoAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    await assertOrgAccess(ctx, analysis.orgId);

    return await ctx.db
      .query("videoActivityLogs")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .order("desc")
      .take(100);
  },
});

// Speaker mapping query API for human-in-the-loop pause/resume flow.
export const getSpeakerMappingState = query({
  args: { analysisId: v.id("videoAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");
    await assertOrgAccess(ctx, analysis.orgId);

    const transcript = analysis.transcriptId
      ? await ctx.db.get(analysis.transcriptId)
      : ((
          await ctx.db
            .query("videoTranscripts")
            .withIndex("by_video_analysis", (q) => q.eq("videoAnalysisId", args.analysisId))
            .collect()
        )[0] ?? null);

    const utterances = transcript?.utterances ?? [];
    const mappings = transcript?.speakerMapping ?? [];
    const speakerIds = Array.from(new Set(utterances.map((u) => u.speakerId)));
    const mappedSpeakerIds = new Set(mappings.map((m) => m.speakerId));
    const unmappedSpeakerIds = speakerIds.filter((id) => !mappedSpeakerIds.has(id));

    return {
      analysisId: args.analysisId,
      status: analysis.status,
      speakerMappingComplete: analysis.speakerMappingComplete,
      totalSpeakers: speakerIds.length,
      unmappedSpeakers: unmappedSpeakerIds,
      mappings,
    };
  },
});

export const mapSpeakerToTeamMember = mutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    speakerId: v.string(),
    userId: v.id("users"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");
    await assertOrgAccess(ctx, analysis.orgId);

    const transcript = analysis.transcriptId
      ? await ctx.db.get(analysis.transcriptId)
      : ((
          await ctx.db
            .query("videoTranscripts")
            .withIndex("by_video_analysis", (q) => q.eq("videoAnalysisId", args.analysisId))
            .collect()
        )[0] ?? null);
    if (!transcript) throw new ConvexError("Transcript not available yet");

    const teamMember = (
      await ctx.db
        .query("teamMembers")
        .withIndex("by_program", (q) => q.eq("programId", analysis.programId))
        .collect()
    ).find((member) => member.userId === args.userId);
    if (!teamMember) {
      throw new ConvexError("User is not a team member in this program");
    }

    const user = await ctx.db.get(args.userId);
    const existing = transcript.speakerMapping ?? [];
    const filtered = existing.filter((m) => m.speakerId !== args.speakerId);
    filtered.push({
      speakerId: args.speakerId,
      name: user?.name ?? "Team Member",
      role: args.role ?? teamMember.role,
      userId: args.userId,
      isExternal: false,
    });

    await ctx.db.patch(transcript._id, { speakerMapping: filtered });
    return { ok: true };
  },
});

export const addExternalSpeakerMapping = mutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    speakerId: v.string(),
    name: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");
    await assertOrgAccess(ctx, analysis.orgId);

    const transcript = analysis.transcriptId
      ? await ctx.db.get(analysis.transcriptId)
      : ((
          await ctx.db
            .query("videoTranscripts")
            .withIndex("by_video_analysis", (q) => q.eq("videoAnalysisId", args.analysisId))
            .collect()
        )[0] ?? null);
    if (!transcript) throw new ConvexError("Transcript not available yet");

    const existing = transcript.speakerMapping ?? [];
    const filtered = existing.filter((m) => m.speakerId !== args.speakerId);
    filtered.push({
      speakerId: args.speakerId,
      name: args.name,
      role: args.role,
      isExternal: true,
    });

    await ctx.db.patch(transcript._id, { speakerMapping: filtered });
    return { ok: true };
  },
});

export const completeSpeakerMapping = mutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    skipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");
    await assertOrgAccess(ctx, analysis.orgId);

    await ctx.db.patch(args.analysisId, { speakerMappingComplete: true });
    return {
      ok: true,
      skipped: args.skipped ?? false,
    };
  },
});

// Internal read API used by actions and pipelines.
export const getById = internalQuery({
  args: { analysisId: v.id("videoAnalyses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.analysisId);
  },
});

// --- Phase 4 internal functions for pipeline wiring ---

export const createFrameExtraction = internalMutation({
  args: {
    orgId: v.string(),
    videoAnalysisId: v.id("videoAnalyses"),
    totalFramesExtracted: v.number(),
    uniqueKeyframes: v.number(),
    classifiedFrames: v.array(
      v.object({
        timestampMs: v.number(),
        frameUrl: v.string(),
        category: v.string(),
        description: v.optional(v.string()),
        confidence: v.optional(v.number()),
      }),
    ),
    screenShareSegments: v.array(
      v.object({
        startMs: v.number(),
        endMs: v.number(),
        keyframeCount: v.optional(v.number()),
      }),
    ),
    webcamOnlyPercent: v.number(),
    pass1TokensUsed: v.number(),
    pass2TokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("videoFrameExtractions", args);
  },
});

export const createTranscript = internalMutation({
  args: {
    orgId: v.string(),
    videoAnalysisId: v.id("videoAnalyses"),
    transcriptionService: v.string(),
    language: v.string(),
    totalDurationMs: v.number(),
    speakerCount: v.number(),
    utterances: v.array(
      v.object({
        speakerId: v.string(),
        startMs: v.number(),
        endMs: v.number(),
        text: v.string(),
        confidence: v.optional(v.number()),
      }),
    ),
    fullText: v.string(),
    wordCount: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("videoTranscripts", args);
  },
});

export const updateFrameExtraction = internalMutation({
  args: {
    frameExtractionId: v.id("videoFrameExtractions"),
    classifiedFrames: v.array(
      v.object({
        timestampMs: v.number(),
        frameUrl: v.string(),
        category: v.string(),
        description: v.optional(v.string()),
        confidence: v.optional(v.number()),
      }),
    ),
    pass2TokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.frameExtractionId);
    if (!existing) throw new ConvexError("Frame extraction not found");

    const patch: Record<string, unknown> = {
      classifiedFrames: args.classifiedFrames,
    };
    if (args.pass2TokensUsed !== undefined) {
      patch.pass2TokensUsed = args.pass2TokensUsed;
    }

    await ctx.db.patch(args.frameExtractionId, patch);
  },
});

export const patchAnalysisFields = internalMutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    audioFileUrl: v.optional(v.string()),
    transcriptId: v.optional(v.id("videoTranscripts")),
    frameExtractionId: v.optional(v.id("videoFrameExtractions")),
    videoDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    const patch: Record<string, unknown> = {};
    if (args.audioFileUrl !== undefined) patch.audioFileUrl = args.audioFileUrl;
    if (args.transcriptId !== undefined) patch.transcriptId = args.transcriptId;
    if (args.frameExtractionId !== undefined) patch.frameExtractionId = args.frameExtractionId;
    if (args.videoDurationMs !== undefined) patch.videoDurationMs = args.videoDurationMs;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.analysisId, patch);
    }
  },
});

export const patchTwelveLabsFields = internalMutation({
  args: {
    analysisId: v.id("videoAnalyses"),
    tlIndexId: v.optional(v.string()),
    tlVideoId: v.optional(v.string()),
    tlTaskId: v.optional(v.string()),
    tlSummary: v.optional(v.string()),
    tlChapters: v.optional(v.array(v.any())),
    tlTopics: v.optional(v.array(v.string())),
    tlGist: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError("Video analysis not found");

    const patch: Record<string, unknown> = {};
    if (args.tlIndexId !== undefined) patch.tlIndexId = args.tlIndexId;
    if (args.tlVideoId !== undefined) patch.tlVideoId = args.tlVideoId;
    if (args.tlTaskId !== undefined) patch.tlTaskId = args.tlTaskId;
    if (args.tlSummary !== undefined) patch.tlSummary = args.tlSummary;
    if (args.tlChapters !== undefined) patch.tlChapters = args.tlChapters;
    if (args.tlTopics !== undefined) patch.tlTopics = args.tlTopics;
    if (args.tlGist !== undefined) patch.tlGist = args.tlGist;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.analysisId, patch);
    }
  },
});

export const getOrCreateOrgIndex = internalMutation({
  args: {
    orgId: v.string(),
    indexId: v.optional(v.string()),
    indexName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("twelveLabsIndexes")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (existing) return existing;

    if (args.indexId === undefined || args.indexName === undefined) {
      throw new ConvexError(
        "indexId and indexName are required when creating a Twelve Labs index record",
      );
    }

    const indexDocId = await ctx.db.insert("twelveLabsIndexes", {
      orgId: args.orgId,
      indexId: args.indexId,
      indexName: args.indexName,
      createdAt: Date.now(),
    });

    const created = await ctx.db.get(indexDocId);
    if (!created) {
      throw new ConvexError("Failed to create Twelve Labs index record");
    }

    return created;
  },
});

export const getFrameExtractionById = internalQuery({
  args: { frameExtractionId: v.id("videoFrameExtractions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.frameExtractionId);
  },
});

export const getTranscriptById = internalQuery({
  args: { transcriptId: v.id("videoTranscripts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transcriptId);
  },
});
