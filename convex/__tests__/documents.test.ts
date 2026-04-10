import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

// ── listByProgram ───────────────────────────────────────────────────

describe("documents.listByProgram", () => {
  test("returns documents for a program", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "requirements.pdf",
        fileType: "pdf",
        fileSize: 1024,
        category: "requirements",
        uploadedBy: userId,
      });
    });

    const docs = await asUser.query(apiAny.documents.listByProgram, {
      programId,
    });
    expect(docs).toHaveLength(1);
    expect(docs[0].fileName).toBe("requirements.pdf");
    expect(docs[0].uploaderName).toBe("User One");
  });

  test("filters by category", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "arch.pdf",
        fileType: "pdf",
        fileSize: 512,
        category: "architecture",
        uploadedBy: userId,
      });
      await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "tests.pdf",
        fileType: "pdf",
        fileSize: 256,
        category: "testing",
        uploadedBy: userId,
      });
    });

    const filtered = await asUser.query(apiAny.documents.listByProgram, {
      programId,
      category: "architecture",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].fileName).toBe("arch.pdf");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.documents.listByProgram, { programId }),
    ).rejects.toThrow();
  });
});

// ── get ─────────────────────────────────────────────────────────────

describe("documents.get", () => {
  test("returns a document by ID", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "report.docx",
        fileType: "docx",
        fileSize: 2048,
        category: "other",
        uploadedBy: userId,
      });
    });

    const doc = await asUser.query(apiAny.documents.get, { documentId });
    expect(doc.fileName).toBe("report.docx");
    expect(doc.uploaderName).toBe("User One");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "secret.pdf",
        fileType: "pdf",
        fileSize: 100,
        category: "other",
        uploadedBy: userId,
      });
    });

    await expect(asOtherUser.query(apiAny.documents.get, { documentId })).rejects.toThrow();
  });
});

// ── update ──────────────────────────────────────────────────────────

describe("documents.update", () => {
  test("updates category and description", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "file.pdf",
        fileType: "pdf",
        fileSize: 100,
        category: "other",
        uploadedBy: userId,
      });
    });

    await asUser.mutation(apiAny.documents.update, {
      documentId,
      category: "architecture",
      description: "Architecture doc",
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(documentId));
    expect(updated.category).toBe("architecture");
    expect(updated.description).toBe("Architecture doc");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "locked.pdf",
        fileType: "pdf",
        fileSize: 100,
        category: "other",
        uploadedBy: userId,
      });
    });

    await expect(
      asOtherUser.mutation(apiAny.documents.update, {
        documentId,
        category: "testing",
      }),
    ).rejects.toThrow();
  });
});

// ── remove ──────────────────────────────────────────────────────────

describe("documents.remove", () => {
  test("removes a document", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "delete-me.pdf",
        fileType: "pdf",
        fileSize: 100,
        category: "other",
        uploadedBy: userId,
      });
    });

    await asUser.mutation(apiAny.documents.remove, { documentId });

    const deleted = await t.run(async (ctx: any) => ctx.db.get(documentId));
    expect(deleted).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "protected.pdf",
        fileType: "pdf",
        fileSize: 100,
        category: "other",
        uploadedBy: userId,
      });
    });

    await expect(asOtherUser.mutation(apiAny.documents.remove, { documentId })).rejects.toThrow();
  });
});

// ── getById (internal) ──────────────────────────────────────────────

describe("documents.getById (internal)", () => {
  test("returns document without auth check", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await setupTestEnv(t);

    const documentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: "org-1",
        programId,
        fileName: "internal.pdf",
        fileType: "pdf",
        fileSize: 100,
        category: "other",
        uploadedBy: userId,
      });
    });

    const doc = await t.query(internalAny.documents.getById, { documentId });
    expect(doc).not.toBeNull();
    expect(doc.fileName).toBe("internal.pdf");
  });
});
