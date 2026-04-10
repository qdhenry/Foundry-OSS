import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;

import schema from "../schema";
import { modules } from "../test.helpers";

async function setupBaseData(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "user1@example.com",
      name: "User One",
      orgIds: ["org-1"],
      role: "admin",
    });
  });

  await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-2",
      email: "user2@example.com",
      name: "User Two",
      orgIds: ["org-2"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-1",
      name: "Test Program",
      clientName: "Test Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "discovery",
      status: "active",
    });
  });

  const documentId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("documents", {
      orgId: "org-1",
      programId,
      fileName: "test-doc.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      category: "requirements" as const,
      uploadedBy: userId,
    });
  });

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Backend",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  const analysisId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("documentAnalyses", {
      orgId: "org-1",
      programId,
      documentId,
      status: "complete",
      analysisVersion: 1,
    });
  });

  return { userId, programId, documentId, analysisId, workstreamId };
}

// ── listByProgram ────────────────────────────────────────────────────

describe("discoveryFindings.listByProgram", () => {
  test("returns findings for a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Finding 1", description: "Desc" },
        status: "pending",
      });
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "risk",
        confidence: "medium",
        data: { title: "Risk Finding", description: "Risky" },
        status: "pending",
      });
    });

    const findings = await asUser.query(apiAny.discoveryFindings.listByProgram, {
      programId: data.programId,
    });
    expect(findings).toHaveLength(2);
    expect(findings[0].documentName).toBe("test-doc.pdf");
  });

  test("filters by type", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Req Finding" },
        status: "pending",
      });
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "risk",
        confidence: "medium",
        data: { title: "Risk Finding" },
        status: "pending",
      });
    });

    const findings = await asUser.query(apiAny.discoveryFindings.listByProgram, {
      programId: data.programId,
      type: "requirement",
    });
    expect(findings).toHaveLength(1);
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Pending" },
        status: "pending",
      });
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Approved" },
        status: "approved",
      });
    });

    const findings = await asUser.query(apiAny.discoveryFindings.listByProgram, {
      programId: data.programId,
      status: "approved",
    });
    expect(findings).toHaveLength(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.discoveryFindings.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── countPending ─────────────────────────────────────────────────────

describe("discoveryFindings.countPending", () => {
  test("counts pending findings", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Pending 1" },
        status: "pending",
      });
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "risk",
        confidence: "medium",
        data: { title: "Pending 2" },
        status: "pending",
      });
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Approved" },
        status: "approved",
      });
    });

    const result = await asUser.query(apiAny.discoveryFindings.countPending, {
      programId: data.programId,
    });
    expect(result.count).toBe(2);
  });
});

// ── reviewFinding ────────────────────────────────────────────────────

describe("discoveryFindings.reviewFinding", () => {
  test("approves a finding", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "To Approve" },
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.discoveryFindings.reviewFinding, {
      findingId,
      status: "approved",
    });

    const finding = await t.run(async (ctx: any) => await ctx.db.get(findingId));
    expect(finding.status).toBe("approved");
    expect(finding.reviewedBy).toBe(data.userId);
    expect(finding.reviewedAt).toBeDefined();
  });

  test("rejects a finding", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "risk",
        confidence: "low",
        data: { title: "To Reject" },
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.discoveryFindings.reviewFinding, {
      findingId,
      status: "rejected",
    });

    const finding = await t.run(async (ctx: any) => await ctx.db.get(findingId));
    expect(finding.status).toBe("rejected");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Private" },
        status: "pending",
      });
    });

    await expect(
      asOtherUser.mutation(apiAny.discoveryFindings.reviewFinding, {
        findingId,
        status: "approved",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── editFinding ──────────────────────────────────────────────────────

describe("discoveryFindings.editFinding", () => {
  test("edits finding data", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Original", description: "Old desc" },
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.discoveryFindings.editFinding, {
      findingId,
      editedData: { title: "Edited", description: "New desc" },
    });

    const finding = await t.run(async (ctx: any) => await ctx.db.get(findingId));
    expect(finding.status).toBe("edited");
    expect(finding.editedData).toEqual({
      title: "Edited",
      description: "New desc",
    });
  });
});

// ── bulkReviewFindings ───────────────────────────────────────────────

describe("discoveryFindings.bulkReviewFindings", () => {
  test("bulk approves findings", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingIds = await t.run(async (ctx: any) => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push(
          await ctx.db.insert("discoveryFindings", {
            orgId: "org-1",
            programId: data.programId,
            documentId: data.documentId,
            analysisId: data.analysisId,
            type: "requirement",
            confidence: "high",
            data: { title: `Finding ${i}` },
            status: "pending",
          }),
        );
      }
      return ids;
    });

    const result = await asUser.mutation(apiAny.discoveryFindings.bulkReviewFindings, {
      findingIds,
      status: "approved",
    });

    expect(result.updated).toBe(3);

    for (const id of findingIds) {
      const finding = await t.run(async (ctx: any) => await ctx.db.get(id));
      expect(finding.status).toBe("approved");
    }
  });

  test("returns 0 for empty array", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.mutation(apiAny.discoveryFindings.bulkReviewFindings, {
      findingIds: [],
      status: "approved",
    });
    expect(result.updated).toBe(0);
  });
});

// ── importApprovedFindings ───────────────────────────────────────────

describe("discoveryFindings.importApprovedFindings", () => {
  test("imports requirement findings", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: {
          title: "Import Me",
          description: "A good requirement",
          priority: "must_have",
          fitGap: "native",
        },
        status: "approved",
      });
    });

    const result = await asUser.mutation(apiAny.discoveryFindings.importApprovedFindings, {
      programId: data.programId,
    });

    expect(result.requirements).toBe(1);

    const requirements = await t.run(
      async (ctx: any) =>
        await ctx.db
          .query("requirements")
          .withIndex("by_program", (q: any) => q.eq("programId", data.programId))
          .collect(),
    );
    expect(requirements).toHaveLength(1);
    expect(requirements[0].title).toBe("Import Me");
    expect(requirements[0].status).toBe("draft");
  });

  test("imports risk findings", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "risk",
        confidence: "high",
        data: {
          title: "Import Risk",
          description: "Risky business",
          severity: "high",
          probability: "likely",
        },
        status: "approved",
      });
    });

    const result = await asUser.mutation(apiAny.discoveryFindings.importApprovedFindings, {
      programId: data.programId,
    });

    expect(result.risks).toBe(1);

    const risks = await t.run(
      async (ctx: any) =>
        await ctx.db
          .query("risks")
          .withIndex("by_program", (q: any) => q.eq("programId", data.programId))
          .collect(),
    );
    expect(risks).toHaveLength(1);
    expect(risks[0].title).toBe("Import Risk");
    expect(risks[0].severity).toBe("high");
  });

  test("returns zero counts when nothing to import", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.mutation(apiAny.discoveryFindings.importApprovedFindings, {
      programId: data.programId,
    });

    expect(result.requirements).toBe(0);
    expect(result.risks).toBe(0);
    expect(result.integrations).toBe(0);
    expect(result.decisions).toBe(0);
    expect(result.tasks).toBe(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.discoveryFindings.importApprovedFindings, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── acquireLock / releaseLock ────────────────────────────────────────

describe("discoveryFindings.acquireLock", () => {
  test("acquires lock on a finding", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Lockable" },
        status: "pending",
      });
    });

    const result = await asUser.mutation(apiAny.discoveryFindings.acquireLock, {
      findingId,
    });
    expect(result.acquired).toBe(true);
  });
});

describe("discoveryFindings.releaseLock", () => {
  test("releases lock", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "Locked" },
        status: "pending",
        editedData: {
          __lock: {
            userId: data.userId,
            userName: "User One",
            acquiredAt: Date.now(),
            expiresAt: Date.now() + 30000,
          },
        },
      });
    });

    const result = await asUser.mutation(apiAny.discoveryFindings.releaseLock, {
      findingId,
    });
    expect(result.released).toBe(true);
  });

  test("returns no_lock when no lock exists", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const findingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("discoveryFindings", {
        orgId: "org-1",
        programId: data.programId,
        documentId: data.documentId,
        analysisId: data.analysisId,
        type: "requirement",
        confidence: "high",
        data: { title: "No Lock" },
        status: "pending",
      });
    });

    const result = await asUser.mutation(apiAny.discoveryFindings.releaseLock, {
      findingId,
    });
    expect(result.released).toBe(false);
    expect(result.reason).toBe("no_lock");
  });
});
