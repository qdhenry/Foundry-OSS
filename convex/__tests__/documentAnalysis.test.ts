import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: create a document for analysis testing.
 */
async function seedDocument(t: any, opts: { orgId: string; programId: string; userId: string }) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("documents", {
      orgId: opts.orgId,
      programId: opts.programId,
      fileName: "test-document.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      category: "requirements",
      uploadedBy: opts.userId,
    });
  });
}

// ── createAnalysis ──────────────────────────────────────────────────

describe("documentAnalysis.createAnalysis", () => {
  test("creates a queued analysis record", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    expect(analysisId).toBeTruthy();

    const analysis = await t.run(async (ctx: any) => {
      return await ctx.db.get(analysisId);
    });

    expect(analysis.status).toBe("queued");
    expect(analysis.analysisVersion).toBe(1);
    expect(analysis.programId).toBe(programId);
    expect(analysis.documentId).toBe(documentId);
  });
});

// ── updateAnalysisStatus ────────────────────────────────────────────

describe("documentAnalysis.updateAnalysisStatus", () => {
  test("transitions status from queued to extracting", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.updateAnalysisStatus, {
      analysisId,
      status: "extracting",
    });

    const analysis = await t.run(async (ctx: any) => {
      return await ctx.db.get(analysisId);
    });
    expect(analysis.status).toBe("extracting");

    // Check document status is mirrored
    const doc = await t.run(async (ctx: any) => {
      return await ctx.db.get(documentId);
    });
    expect(doc.analysisStatus).toBe("analyzing");
  });

  test("sets failed status with error on document", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.updateAnalysisStatus, {
      analysisId,
      status: "failed",
      error: "Extraction failed",
    });

    const analysis = await t.run(async (ctx: any) => {
      return await ctx.db.get(analysisId);
    });
    expect(analysis.status).toBe("failed");
    expect(analysis.error).toBe("Extraction failed");

    const doc = await t.run(async (ctx: any) => {
      return await ctx.db.get(documentId);
    });
    expect(doc.analysisStatus).toBe("failed");
    expect(doc.analysisError).toBe("Extraction failed");
  });

  test("maps complete status to document", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.updateAnalysisStatus, {
      analysisId,
      status: "complete",
    });

    const doc = await t.run(async (ctx: any) => {
      return await ctx.db.get(documentId);
    });
    expect(doc.analysisStatus).toBe("complete");
  });
});

// ── getById ─────────────────────────────────────────────────────────

describe("documentAnalysis.getById", () => {
  test("returns analysis by id", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    const result = await t.query(internalAny.documentAnalysis.getById, {
      analysisId,
    });

    expect(result).not.toBeNull();
    expect(result._id).toBe(analysisId);
    expect(result.status).toBe("queued");
  });
});

// ── storeAnalysisResults ────────────────────────────────────────────

describe("documentAnalysis.storeAnalysisResults", () => {
  test("stores findings and updates document", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.storeAnalysisResults, {
      analysisId,
      findings: { requirements: [], risks: [] },
      claudeModelId: "claude-opus-4-6",
      claudeRequestId: "req-123",
      inputTokens: 5000,
      outputTokens: 2000,
      cacheReadTokens: 4500,
      cacheCreationTokens: 500,
      durationMs: 3200,
    });

    const analysis = await t.run(async (ctx: any) => {
      return await ctx.db.get(analysisId);
    });

    expect(analysis.status).toBe("complete");
    expect(analysis.findings).toEqual({ requirements: [], risks: [] });
    expect(analysis.claudeModelId).toBe("claude-opus-4-6");
    expect(analysis.inputTokens).toBe(5000);
    expect(analysis.durationMs).toBe(3200);

    const doc = await t.run(async (ctx: any) => {
      return await ctx.db.get(documentId);
    });
    expect(doc.analysisStatus).toBe("complete");
    expect(doc.latestAnalysisId).toBe(analysisId);
  });
});

// ── createDiscoveryFindings ─────────────────────────────────────────

describe("documentAnalysis.createDiscoveryFindings", () => {
  test("creates findings from analysis results", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.createDiscoveryFindings, {
      orgId,
      programId,
      analysisId,
      documentId,
      findings: {
        requirements: [
          {
            data: { title: "Need SSO" },
            confidence: "high",
            sourceExcerpt: "Must support SSO",
          },
        ],
        risks: [
          {
            data: { title: "API limit risk" },
            confidence: "medium",
          },
        ],
      },
    });

    const allFindings = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("discoveryFindings")
        .withIndex("by_analysis", (q: any) => q.eq("analysisId", analysisId))
        .collect();
    });

    expect(allFindings).toHaveLength(2);

    const reqFinding = allFindings.find((f: any) => f.type === "requirement");
    expect(reqFinding).toBeTruthy();
    expect(reqFinding.status).toBe("pending");
    expect(reqFinding.confidence).toBe("high");
    expect(reqFinding.data.title).toBe("Need SSO");

    const riskFinding = allFindings.find((f: any) => f.type === "risk");
    expect(riskFinding).toBeTruthy();
    expect(riskFinding.confidence).toBe("medium");
  });

  test("handles empty findings gracefully", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.createDiscoveryFindings, {
      orgId,
      programId,
      analysisId,
      documentId,
      findings: {},
    });

    const allFindings = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("discoveryFindings")
        .withIndex("by_analysis", (q: any) => q.eq("analysisId", analysisId))
        .collect();
    });

    expect(allFindings).toHaveLength(0);
  });
});

// ── logActivity ─────────────────────────────────────────────────────

describe("documentAnalysis.logActivity", () => {
  test("inserts an activity log entry", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.logActivity, {
      orgId,
      programId,
      analysisId,
      step: "extraction",
      message: "Extracting text from PDF",
      level: "info",
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("analysisActivityLogs")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].step).toBe("extraction");
    expect(logs[0].message).toBe("Extracting text from PDF");
    expect(logs[0].level).toBe("info");
  });
});

// ── getBatchProgress ────────────────────────────────────────────────

describe("documentAnalysis.getBatchProgress", () => {
  test("returns progress for all analyses in program", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId, asUser } = await setupTestEnv(t);

    const doc1 = await seedDocument(t, { orgId, programId, userId });
    const doc2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId,
        programId,
        fileName: "second-doc.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        category: "architecture",
        uploadedBy: userId,
      });
    });

    await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId: doc1,
    });
    await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId: doc2,
    });

    const progress = await asUser.query(apiAny.documentAnalysis.getBatchProgress, {
      programId,
    });

    expect(progress).toHaveLength(2);
    expect(progress.every((p: any) => p.status === "queued")).toBe(true);
    const names = progress.map((p: any) => p.documentName);
    expect(names).toContain("test-document.pdf");
    expect(names).toContain("second-doc.pdf");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { programId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.documentAnalysis.getBatchProgress, {
        programId,
      }),
    ).rejects.toThrow();
  });
});

// ── getByDocument ───────────────────────────────────────────────────

describe("documentAnalysis.getByDocument", () => {
  test("returns latest analysis for a document", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId, asUser } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    const result = await asUser.query(apiAny.documentAnalysis.getByDocument, {
      documentId,
    });

    expect(result).not.toBeNull();
    expect(result.documentId).toBe(documentId);
    expect(result.status).toBe("queued");
  });

  test("returns null when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId, asUser } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const result = await asUser.query(apiAny.documentAnalysis.getByDocument, {
      documentId,
    });

    expect(result).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId, asOtherUser } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    await expect(
      asOtherUser.query(apiAny.documentAnalysis.getByDocument, {
        documentId,
      }),
    ).rejects.toThrow();
  });
});

// ── getActivityLogs ─────────────────────────────────────────────────

describe("documentAnalysis.getActivityLogs", () => {
  test("returns all activity logs for a program", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, userId, asUser } = await setupTestEnv(t);
    const documentId = await seedDocument(t, { orgId, programId, userId });

    const analysisId = await t.mutation(internalAny.documentAnalysis.createAnalysis, {
      orgId,
      programId,
      documentId,
    });

    await t.mutation(internalAny.documentAnalysis.logActivity, {
      orgId,
      programId,
      analysisId,
      step: "extraction",
      message: "Starting extraction",
      level: "info",
    });

    await t.mutation(internalAny.documentAnalysis.logActivity, {
      orgId,
      programId,
      analysisId,
      step: "analysis",
      message: "Analysis complete",
      level: "success",
    });

    const logs = await asUser.query(apiAny.documentAnalysis.getActivityLogs, {
      programId,
    });

    expect(logs).toHaveLength(2);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { programId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.documentAnalysis.getActivityLogs, {
        programId,
      }),
    ).rejects.toThrow();
  });
});
