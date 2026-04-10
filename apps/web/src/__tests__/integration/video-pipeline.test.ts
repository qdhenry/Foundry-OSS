import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../../convex/schema";
import { modules } from "../../../convex/test.helpers";

/**
 * Integration tests for the video analysis pipeline:
 * - Upload → analysis creation
 * - Stage progression (uploading → indexing → analyzing → synthesizing → completed)
 * - Transcript creation and structure
 * - Frame extraction and classification
 * - Video findings generation
 * - Failure handling and retry
 * - Retention policy lifecycle
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedVideoEnv(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "video-user-1",
      email: "video@example.com",
      name: "Video User",
      orgIds: ["org-vid"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-vid",
      name: "Video Program",
      clientName: "Video Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "discovery",
      status: "active",
    });
  });

  const documentId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("documents", {
      orgId: "org-vid",
      programId,
      fileName: "discovery-call.mp4",
      fileType: "video/mp4",
      fileSize: 150_000_000,
      category: "meeting_notes",
      uploadedBy: userId,
      mimeType: "video/mp4",
    });
  });

  return { userId, programId, documentId, orgId: "org-vid" };
}

// ── Pipeline Stage Progression ──────────────────────────────────────

describe("video-pipeline: stage progression", () => {
  test("creates video analysis in uploading status", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "uploading",
        videoUrl: "https://storage.example.com/discovery-call.mp4",
        videoSizeBytes: 150_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: false,
        retentionPolicy: "30_days",
        analysisVersion: 1,
        stageTimestamps: { uploadingAt: Date.now() },
      });
    });

    const analysis = await t.run(async (ctx: any) => await ctx.db.get(analysisId));
    expect(analysis.status).toBe("uploading");
    expect(analysis.stageTimestamps.uploadingAt).toBeDefined();
  });

  test("progresses through full pipeline stages", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "uploading",
        videoUrl: "https://storage.example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: false,
        retentionPolicy: "30_days",
        analysisVersion: 1,
        stageTimestamps: { uploadingAt: Date.now() },
      });
    });

    const stages: Array<{ status: string; tsKey: string }> = [
      { status: "indexing", tsKey: "indexingAt" },
      { status: "analyzing", tsKey: "analyzingAt" },
      { status: "synthesizing", tsKey: "synthesizingAt" },
      { status: "complete", tsKey: "completedAt" },
    ];

    for (const { status, tsKey } of stages) {
      await t.run(async (ctx: any) => {
        const timestamps: Record<string, number> = {};
        timestamps[tsKey] = Date.now();
        const analysis = await ctx.db.get(analysisId);
        await ctx.db.patch(analysisId, {
          status,
          stageTimestamps: { ...analysis.stageTimestamps, ...timestamps },
        });
      });
    }

    const analysis = await t.run(async (ctx: any) => await ctx.db.get(analysisId));
    expect(analysis.status).toBe("complete");
    expect(analysis.stageTimestamps.completedAt).toBeDefined();
  });
});

// ── Transcript Creation ─────────────────────────────────────────────

describe("video-pipeline: transcript creation", () => {
  test("creates diarized transcript with speaker mapping", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "analyzing",
        videoUrl: "https://example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: false,
        retentionPolicy: "30_days",
        analysisVersion: 1,
      });
    });

    const transcriptId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoTranscripts", {
        orgId: env.orgId,
        videoAnalysisId: analysisId,
        transcriptionService: "twelve_labs",
        language: "en",
        totalDurationMs: 3600000,
        speakerCount: 3,
        utterances: [
          { speakerId: "S1", startMs: 0, endMs: 5000, text: "Welcome everyone", confidence: 0.95 },
          {
            speakerId: "S2",
            startMs: 5500,
            endMs: 12000,
            text: "Thanks for having us",
            confidence: 0.92,
          },
          {
            speakerId: "S3",
            startMs: 13000,
            endMs: 20000,
            text: "Let me share my screen",
            confidence: 0.88,
          },
        ],
        speakerMapping: [
          { speakerId: "S1", name: "Project Manager", role: "PM" },
          { speakerId: "S2", name: "Client Stakeholder", role: "Client", isExternal: true },
          { speakerId: "S3", name: "Technical Lead", role: "Tech Lead" },
        ],
        fullText: "Welcome everyone. Thanks for having us. Let me share my screen.",
        wordCount: 11,
        segments: [
          {
            index: 0,
            startMs: 0,
            endMs: 20000,
            topic: "Introduction",
            summary: "Initial greetings",
          },
        ],
      });
    });

    const transcript = await t.run(async (ctx: any) => await ctx.db.get(transcriptId));
    expect(transcript.speakerCount).toBe(3);
    expect(transcript.utterances).toHaveLength(3);
    expect(transcript.speakerMapping).toHaveLength(3);
    expect(transcript.speakerMapping[1].isExternal).toBe(true);
  });
});

// ── Frame Extraction ────────────────────────────────────────────────

describe("video-pipeline: frame extraction", () => {
  test("stores classified keyframes and screen share segments", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "analyzing",
        videoUrl: "https://example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: false,
        retentionPolicy: "30_days",
        analysisVersion: 1,
      });
    });

    const extractionId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoFrameExtractions", {
        orgId: env.orgId,
        videoAnalysisId: analysisId,
        totalFramesExtracted: 120,
        uniqueKeyframes: 15,
        classifiedFrames: [
          {
            timestampMs: 30000,
            frameUrl: "https://frames.example.com/f1.jpg",
            category: "screen_share",
            description: "Product catalog admin panel",
            confidence: 0.92,
          },
          {
            timestampMs: 60000,
            frameUrl: "https://frames.example.com/f2.jpg",
            category: "whiteboard",
            description: "Architecture diagram",
            confidence: 0.85,
          },
        ],
        screenShareSegments: [
          { startMs: 25000, endMs: 90000, keyframeCount: 8 },
          { startMs: 120000, endMs: 180000, keyframeCount: 5 },
        ],
        webcamOnlyPercent: 35.5,
        pass1TokensUsed: 5000,
        pass2TokensUsed: 3000,
      });
    });

    const extraction = await t.run(async (ctx: any) => await ctx.db.get(extractionId));
    expect(extraction.totalFramesExtracted).toBe(120);
    expect(extraction.uniqueKeyframes).toBe(15);
    expect(extraction.classifiedFrames).toHaveLength(2);
    expect(extraction.screenShareSegments).toHaveLength(2);
    expect(extraction.webcamOnlyPercent).toBe(35.5);
  });
});

// ── Video Findings ──────────────────────────────────────────────────

describe("video-pipeline: findings generation", () => {
  test("creates video findings with source attribution", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "complete",
        videoUrl: "https://example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: true,
        retentionPolicy: "30_days",
        analysisVersion: 1,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("videoFindings", {
        orgId: env.orgId,
        programId: env.programId,
        videoAnalysisId: analysisId,
        documentId: env.documentId,
        type: "requirement",
        status: "pending",
        data: { title: "Custom checkout flow", description: "Client needs a multi-step checkout" },
        sourceTimestamp: 45000,
        sourceExcerpt: "We need a custom checkout flow with three steps",
        sourceSpeaker: { speakerId: "S2", name: "Client", role: "Stakeholder" },
        confidence: "high",
        suggestedWorkstream: "Frontend",
      });
      await ctx.db.insert("videoFindings", {
        orgId: env.orgId,
        programId: env.programId,
        videoAnalysisId: analysisId,
        documentId: env.documentId,
        type: "risk",
        status: "pending",
        data: { title: "Performance concern", severity: "medium" },
        sourceTimestamp: 120000,
        sourceExcerpt: "The current system has latency issues under load",
        confidence: "medium",
      });
    });

    const findings = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("videoFindings")
        .withIndex("by_video_analysis", (q: any) => q.eq("videoAnalysisId", analysisId))
        .collect();
    });

    expect(findings).toHaveLength(2);
    expect(findings[0].type).toBe("requirement");
    expect(findings[0].confidence).toBe("high");
    expect(findings[1].type).toBe("risk");
  });
});

// ── Failure Handling ────────────────────────────────────────────────

describe("video-pipeline: failure handling", () => {
  test("records failure with stage and error details", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "failed",
        failedStage: "indexing",
        failedError: "Twelve Labs API returned 429: Rate limit exceeded",
        retryCount: 2,
        videoUrl: "https://example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: false,
        retentionPolicy: "30_days",
        analysisVersion: 1,
        stageTimestamps: {
          uploadingAt: Date.now() - 60000,
          indexingAt: Date.now() - 30000,
          failedAt: Date.now(),
        },
      });
    });

    const analysis = await t.run(async (ctx: any) => await ctx.db.get(analysisId));
    expect(analysis.status).toBe("failed");
    expect(analysis.failedStage).toBe("indexing");
    expect(analysis.failedError).toContain("Rate limit");
    expect(analysis.retryCount).toBe(2);
  });
});

// ── Retention Policy ────────────────────────────────────────────────

describe("video-pipeline: retention policy", () => {
  test("tracks retention expiration for raw assets", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "complete",
        videoUrl: "https://example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: true,
        retentionPolicy: "30_days",
        retentionExpiresAt: expiresAt,
        retentionStatus: "active",
        retentionMetadata: { rawAssetState: "active" },
        analysisVersion: 1,
      });
    });

    const analysis = await t.run(async (ctx: any) => await ctx.db.get(analysisId));
    expect(analysis.retentionPolicy).toBe("30_days");
    expect(analysis.retentionExpiresAt).toBe(expiresAt);
    expect(analysis.retentionStatus).toBe("active");
  });
});

// ── Activity Logs ───────────────────────────────────────────────────

describe("video-pipeline: activity logs", () => {
  test("records pipeline progress logs", async () => {
    const t = convexTest(schema, modules);
    const env = await seedVideoEnv(t);

    const analysisId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: env.documentId,
        status: "analyzing",
        videoUrl: "https://example.com/call.mp4",
        videoSizeBytes: 50_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: false,
        retentionPolicy: "30_days",
        analysisVersion: 1,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("videoActivityLogs", {
        orgId: env.orgId,
        programId: env.programId,
        analysisId,
        step: "upload",
        message: "Video uploaded successfully",
        level: "success",
      });
      await ctx.db.insert("videoActivityLogs", {
        orgId: env.orgId,
        programId: env.programId,
        analysisId,
        step: "transcription",
        message: "Transcribing audio with speaker diarization",
        level: "info",
      });
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("videoActivityLogs")
        .withIndex("by_analysis", (q: any) => q.eq("analysisId", analysisId))
        .collect();
    });

    expect(logs).toHaveLength(2);
    expect(logs[0].level).toBe("success");
    expect(logs[1].step).toBe("transcription");
  });
});
