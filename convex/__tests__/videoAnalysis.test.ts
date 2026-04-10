import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { seedCrossOrgUser, seedOrg, seedProgram } from "./helpers/baseFactory";

async function setupVideoData(t: any) {
  const { userId, orgId } = await seedOrg(t);
  await seedCrossOrgUser(t);
  const { programId, workstreamId } = await seedProgram(t, { orgId });

  // Create a document that the video analysis refers to
  const documentId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("documents", {
      orgId,
      programId,
      fileName: "test-video.mp4",
      fileType: "video/mp4",
      fileSize: 50_000_000,
      category: "meeting_notes",
      uploadedBy: userId,
    });
  });

  // Create a video analysis via internal mutation
  const analysisId = await t.mutation(internalAny.videoAnalysis.createAnalysis, {
    orgId,
    programId,
    documentId,
    videoUrl: "https://example.com/video.mp4",
    videoSizeBytes: 50_000_000,
    mimeType: "video/mp4",
    videoDurationMs: 120_000,
  });

  return { userId, orgId, programId, workstreamId, documentId, analysisId };
}

// ── get ─────────────────────────────────────────────────────────────

describe("videoAnalysis.get", () => {
  test("returns analysis for authorized user", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysis = await asUser.query(apiAny.videoAnalysis.get, {
      analysisId: data.analysisId,
    });
    expect(analysis).toBeDefined();
    expect(analysis.orgId).toBe("org-1");
    expect(analysis.videoUrl).toBe("https://example.com/video.mp4");
    expect(analysis.status).toBe("uploading");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.videoAnalysis.get, {
        analysisId: data.analysisId,
      }),
    ).rejects.toThrow();
  });
});

// ── getStatus ───────────────────────────────────────────────────────

describe("videoAnalysis.getStatus", () => {
  test("returns lightweight status object", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const status = await asUser.query(apiAny.videoAnalysis.getStatus, {
      analysisId: data.analysisId,
    });
    expect(status.analysisId).toBe(data.analysisId);
    expect(status.status).toBe("uploading");
    expect(status.stageTimestamps).toBeDefined();
    expect(status.stageTimestamps.uploadingAt).toBeDefined();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.videoAnalysis.getStatus, {
        analysisId: data.analysisId,
      }),
    ).rejects.toThrow();
  });
});

// ── getByDocument ───────────────────────────────────────────────────

describe("videoAnalysis.getByDocument", () => {
  test("returns the latest analysis for a document", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysis = await asUser.query(apiAny.videoAnalysis.getByDocument, {
      documentId: data.documentId,
    });
    expect(analysis).toBeDefined();
    expect(analysis!._id).toBe(data.analysisId);
  });

  test("returns null for document with no analyses", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await seedOrg(t);
    const { programId } = await seedProgram(t, { orgId });
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Need a userId for uploadedBy
    const users = await t.run(async (ctx: any) => {
      return await ctx.db.query("users").collect();
    });
    const userId = users[0]._id;

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId,
        programId,
        fileName: "empty-video.mp4",
        fileType: "video/mp4",
        fileSize: 10_000_000,
        category: "meeting_notes",
        uploadedBy: userId,
      });
    });

    const analysis = await asUser.query(apiAny.videoAnalysis.getByDocument, {
      documentId,
    });
    expect(analysis).toBeNull();
  });
});

// ── listByProgram ───────────────────────────────────────────────────

describe("videoAnalysis.listByProgram", () => {
  test("returns all analyses in a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analyses = await asUser.query(apiAny.videoAnalysis.listByProgram, {
      programId: data.programId,
    });
    expect(analyses).toHaveLength(1);
    expect(analyses[0]._id).toBe(data.analysisId);
  });

  test("filters by status when provided", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // The created analysis is in "uploading" status
    const uploading = await asUser.query(apiAny.videoAnalysis.listByProgram, {
      programId: data.programId,
      status: "uploading",
    });
    expect(uploading).toHaveLength(1);

    const complete = await asUser.query(apiAny.videoAnalysis.listByProgram, {
      programId: data.programId,
      status: "complete",
    });
    expect(complete).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.videoAnalysis.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow();
  });
});

// ── updateStatus (internal) ─────────────────────────────────────────

describe("videoAnalysis.updateStatus", () => {
  test("updates status and stage timestamps", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.mutation(internalAny.videoAnalysis.updateStatus, {
      analysisId: data.analysisId,
      status: "indexing",
    });

    const analysis = await asUser.query(apiAny.videoAnalysis.get, {
      analysisId: data.analysisId,
    });
    expect(analysis.status).toBe("indexing");
    expect(analysis.stageTimestamps.indexingAt).toBeDefined();
    // Original uploading timestamp should be preserved
    expect(analysis.stageTimestamps.uploadingAt).toBeDefined();
  });

  test("records failure information", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.mutation(internalAny.videoAnalysis.updateStatus, {
      analysisId: data.analysisId,
      status: "failed",
      failedStage: "indexing",
      failedError: "TwelveLabs API timeout",
    });

    const status = await asUser.query(apiAny.videoAnalysis.getStatus, {
      analysisId: data.analysisId,
    });
    expect(status.status).toBe("failed");
    expect(status.failedStage).toBe("indexing");
    expect(status.failedError).toBe("TwelveLabs API timeout");
    expect(status.stageTimestamps.failedAt).toBeDefined();
  });
});

// ── completeSpeakerMapping ──────────────────────────────────────────

describe("videoAnalysis.completeSpeakerMapping", () => {
  test("marks speaker mapping as complete", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.mutation(apiAny.videoAnalysis.completeSpeakerMapping, {
      analysisId: data.analysisId,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);

    const analysis = await asUser.query(apiAny.videoAnalysis.get, {
      analysisId: data.analysisId,
    });
    expect(analysis.speakerMappingComplete).toBe(true);
  });

  test("supports skipped flag", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.mutation(apiAny.videoAnalysis.completeSpeakerMapping, {
      analysisId: data.analysisId,
      skipped: true,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.videoAnalysis.completeSpeakerMapping, {
        analysisId: data.analysisId,
      }),
    ).rejects.toThrow();
  });
});

// ── getVideoFindingsByAnalysis ───────────────────────────────────────

describe("videoAnalysis.getVideoFindingsByAnalysis", () => {
  test("returns empty array when no findings exist", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findings = await asUser.query(apiAny.videoAnalysis.getVideoFindingsByAnalysis, {
      analysisId: data.analysisId,
    });
    expect(findings).toEqual([]);
  });

  test("returns findings for a given analysis", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Insert a video finding directly
    await t.run(async (ctx: any) => {
      await ctx.db.insert("videoFindings", {
        orgId: data.orgId,
        programId: data.programId,
        videoAnalysisId: data.analysisId,
        documentId: data.documentId,
        type: "requirement",
        status: "pending",
        data: { title: "Test Finding", description: "A discovered requirement" },
        sourceTimestamp: 5000,
        sourceExcerpt: "We need this feature",
        confidence: "high",
      });
    });

    const findings = await asUser.query(apiAny.videoAnalysis.getVideoFindingsByAnalysis, {
      analysisId: data.analysisId,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("requirement");
    expect(findings[0].confidence).toBe("high");
  });
});

// ── logActivity (internal) ──────────────────────────────────────────

describe("videoAnalysis.logActivity", () => {
  test("creates activity log entry", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.mutation(internalAny.videoAnalysis.logActivity, {
      orgId: data.orgId,
      programId: data.programId,
      analysisId: data.analysisId,
      step: "upload",
      message: "Video uploaded successfully",
      level: "success",
    });

    const logs = await asUser.query(apiAny.videoAnalysis.getActivityLogsByAnalysis, {
      analysisId: data.analysisId,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].step).toBe("upload");
    expect(logs[0].level).toBe("success");
  });
});

// ── getActivityLogs ─────────────────────────────────────────────────

describe("videoAnalysis.getActivityLogs", () => {
  test("returns program-scoped activity logs", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.mutation(internalAny.videoAnalysis.logActivity, {
      orgId: data.orgId,
      programId: data.programId,
      analysisId: data.analysisId,
      step: "indexing",
      message: "Indexing started",
      level: "info",
    });

    const logs = await asUser.query(apiAny.videoAnalysis.getActivityLogs, {
      programId: data.programId,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("Indexing started");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupVideoData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.videoAnalysis.getActivityLogs, {
        programId: data.programId,
      }),
    ).rejects.toThrow();
  });
});
