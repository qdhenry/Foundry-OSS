import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

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
      phase: "build",
      status: "active",
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

  return { userId, programId, workstreamId };
}

// ── listByProgram ────────────────────────────────────────────────────

describe("requirements.listByProgram", () => {
  test("returns requirements sorted by refId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Second Req",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "First Req",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
      });
    });

    const reqs = await asUser.query(apiAny.requirements.listByProgram, {
      programId: data.programId,
    });
    expect(reqs).toHaveLength(2);
    expect(reqs[0].refId).toBe("REQ-001");
    expect(reqs[1].refId).toBe("REQ-002");
  });

  test("filters by priority", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Must Have",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Nice To Have",
        priority: "nice_to_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const reqs = await asUser.query(apiAny.requirements.listByProgram, {
      programId: data.programId,
      priority: "must_have",
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].title).toBe("Must Have");
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Draft",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Complete",
        priority: "must_have",
        fitGap: "native",
        status: "complete",
      });
    });

    const reqs = await asUser.query(apiAny.requirements.listByProgram, {
      programId: data.programId,
      status: "complete",
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].title).toBe("Complete");
  });

  test("filters by workstreamId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        refId: "REQ-001",
        title: "With WS",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Without WS",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const reqs = await asUser.query(apiAny.requirements.listByProgram, {
      programId: data.programId,
      workstreamId: data.workstreamId,
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].title).toBe("With WS");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.requirements.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── get ──────────────────────────────────────────────────────────────

describe("requirements.get", () => {
  test("returns requirement with resolved dependencies", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const depId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Dependency Req",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
      });
    });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Main Req",
        priority: "should_have",
        fitGap: "custom_dev",
        status: "draft",
        dependencies: [depId],
      });
    });

    const req = await asUser.query(apiAny.requirements.get, {
      requirementId: reqId,
    });
    expect(req.title).toBe("Main Req");
    expect(req.resolvedDependencies).toHaveLength(1);
    expect(req.resolvedDependencies[0].title).toBe("Dependency Req");
    expect(req.resolvedDependencies[0].refId).toBe("REQ-001");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Private",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    await expect(
      asOtherUser.query(apiAny.requirements.get, { requirementId: reqId }),
    ).rejects.toThrow("Access denied");
  });
});

// ── create ───────────────────────────────────────────────────────────

describe("requirements.create", () => {
  test("creates requirement with auto-generated refId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await asUser.mutation(apiAny.requirements.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "New Requirement",
      priority: "must_have",
      fitGap: "native",
    });

    const req = await t.run(async (ctx: any) => await ctx.db.get(reqId));
    expect(req.title).toBe("New Requirement");
    expect(req.refId).toBe("REQ-001");
    expect(req.status).toBe("draft");
  });

  test("auto-increments refId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.requirements.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "First",
      priority: "must_have",
      fitGap: "native",
    });

    const reqId2 = await asUser.mutation(apiAny.requirements.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "Second",
      priority: "should_have",
      fitGap: "config",
    });

    const req2 = await t.run(async (ctx: any) => await ctx.db.get(reqId2));
    expect(req2.refId).toBe("REQ-002");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.requirements.create, {
        orgId: "org-1",
        programId: data.programId,
        title: "Unauthorized",
        priority: "must_have",
        fitGap: "native",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── update ───────────────────────────────────────────────────────────

describe("requirements.update", () => {
  test("updates requirement fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Original",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.requirements.update, {
      requirementId: reqId,
      title: "Updated",
      priority: "must_have",
      status: "approved",
    });

    const req = await t.run(async (ctx: any) => await ctx.db.get(reqId));
    expect(req.title).toBe("Updated");
    expect(req.priority).toBe("must_have");
    expect(req.status).toBe("approved");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Private",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    await expect(
      asOtherUser.mutation(apiAny.requirements.update, {
        requirementId: reqId,
        title: "Hacked",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── updateStatus ─────────────────────────────────────────────────────

describe("requirements.updateStatus", () => {
  test("changes status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.requirements.updateStatus, {
      requirementId: reqId,
      status: "complete",
    });

    const req = await t.run(async (ctx: any) => await ctx.db.get(reqId));
    expect(req.status).toBe("complete");
  });
});

// ── linkDependency / unlinkDependency ────────────────────────────────

describe("requirements.linkDependency", () => {
  test("links a dependency", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqAId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req A",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const reqBId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Req B",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.requirements.linkDependency, {
      requirementId: reqAId,
      dependencyId: reqBId,
    });

    const req = await t.run(async (ctx: any) => await ctx.db.get(reqAId));
    expect(req.dependencies).toContain(reqBId);
  });

  test("rejects cross-program dependencies", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const otherProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Other Program",
        clientName: "Client",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
      });
    });

    const reqAId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req A",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const reqBId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: otherProgramId,
        refId: "REQ-001",
        title: "Req B in other program",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    await expect(
      asUser.mutation(apiAny.requirements.linkDependency, {
        requirementId: reqAId,
        dependencyId: reqBId,
      }),
    ).rejects.toThrow("Requirements must be in the same program");
  });
});

describe("requirements.unlinkDependency", () => {
  test("unlinks a dependency", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqBId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Dep",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const reqAId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Main",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
        dependencies: [reqBId],
      });
    });

    await asUser.mutation(apiAny.requirements.unlinkDependency, {
      requirementId: reqAId,
      dependencyId: reqBId,
    });

    const req = await t.run(async (ctx: any) => await ctx.db.get(reqAId));
    expect(req.dependencies).toHaveLength(0);
  });
});

// ── countByStatus ────────────────────────────────────────────────────

describe("requirements.countByStatus", () => {
  test("returns correct counts", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Draft",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Complete",
        priority: "must_have",
        fitGap: "native",
        status: "complete",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-003",
        title: "Complete 2",
        priority: "should_have",
        fitGap: "config",
        status: "complete",
      });
    });

    const counts = await asUser.query(apiAny.requirements.countByStatus, {
      programId: data.programId,
    });
    expect(counts.total).toBe(3);
    expect(counts.draft).toBe(1);
    expect(counts.complete).toBe(2);
    expect(counts.approved).toBe(0);
  });
});

// ── countByPriority ──────────────────────────────────────────────────

describe("requirements.countByPriority", () => {
  test("returns correct counts", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Must Have",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Nice To Have",
        priority: "nice_to_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const counts = await asUser.query(apiAny.requirements.countByPriority, {
      programId: data.programId,
    });
    expect(counts.total).toBe(2);
    expect(counts.must_have).toBe(1);
    expect(counts.nice_to_have).toBe(1);
    expect(counts.should_have).toBe(0);
  });
});

// ── listTitles (internal) ────────────────────────────────────────────

describe("requirements.listTitles (internal)", () => {
  test("returns requirement titles", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Title A",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Title B",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const titles = await t.query(internalAny.requirements.listTitles, {
      programId: data.programId,
    });
    expect(titles).toHaveLength(2);
    expect(titles).toContain("Title A");
    expect(titles).toContain("Title B");
  });
});

// ── remove ──────────────────────────────────────────────────────────

describe("requirements.remove", () => {
  test("deletes a requirement", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "To Delete",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.requirements.remove, {
      requirementId: reqId,
    });

    const deleted = await t.run(async (ctx: any) => await ctx.db.get(reqId));
    expect(deleted).toBeNull();
  });

  test("throws when requirement not found", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Create and immediately delete to get a valid-format but non-existent ID
    const tempId = await t.run(async (ctx: any) => {
      const id = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: (await ctx.db.query("programs").first())._id,
        refId: "REQ-TEMP",
        title: "Temp",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      asUser.mutation(apiAny.requirements.remove, {
        requirementId: tempId,
      }),
    ).rejects.toThrow("Requirement not found");
  });

  test("cascades to delete evidence records", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "With Evidence",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const evidenceId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("evidence", {
        orgId: "org-1",
        requirementId: reqId,
        fileName: "test.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        storageId: "1;_storage" as any,
        uploadedBy: data.userId,
      });
    });

    await asUser.mutation(apiAny.requirements.remove, {
      requirementId: reqId,
    });

    const deletedReq = await t.run(async (ctx: any) => await ctx.db.get(reqId));
    expect(deletedReq).toBeNull();

    const deletedEvidence = await t.run(async (ctx: any) => await ctx.db.get(evidenceId));
    expect(deletedEvidence).toBeNull();
  });

  test("unlinks from tasks on delete", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Linked Req",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Test Task",
        priority: "medium",
        status: "backlog",
        requirementId: reqId,
      });
    });

    await asUser.mutation(apiAny.requirements.remove, {
      requirementId: reqId,
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task).not.toBeNull();
    expect(task.requirementId).toBeUndefined();
  });
});

// ── bulkRemove ──────────────────────────────────────────────────────

describe("requirements.bulkRemove", () => {
  test("deletes multiple requirements", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const ids = await t.run(async (ctx: any) => {
      const id1 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Bulk 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      const id2 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Bulk 2",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
      const id3 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-003",
        title: "Bulk 3",
        priority: "nice_to_have",
        fitGap: "custom_dev",
        status: "draft",
      });
      return [id1, id2, id3];
    });

    const result = await asUser.mutation(apiAny.requirements.bulkRemove, {
      requirementIds: ids,
    });

    expect(result).toEqual({ deleted: 3 });

    for (const id of ids) {
      const deleted = await t.run(async (ctx: any) => await ctx.db.get(id));
      expect(deleted).toBeNull();
    }
  });

  test("returns deleted count of 0 for empty array", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.mutation(apiAny.requirements.bulkRemove, {
      requirementIds: [],
    });

    expect(result).toEqual({ deleted: 0 });
  });

  test("rejects more than 100 items", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Overflow",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const overflowIds = Array(101).fill(reqId);

    await expect(
      asUser.mutation(apiAny.requirements.bulkRemove, {
        requirementIds: overflowIds,
      }),
    ).rejects.toThrow("Cannot delete more than 100 requirements at once");
  });
});

// ── bulkUpdateStatus ────────────────────────────────────────────────

describe("requirements.bulkUpdateStatus", () => {
  test("updates status for all selected requirements", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const ids = await t.run(async (ctx: any) => {
      const id1 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Status 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      const id2 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Status 2",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
      return [id1, id2];
    });

    const result = await asUser.mutation(apiAny.requirements.bulkUpdateStatus, {
      requirementIds: ids,
      status: "approved",
    });

    expect(result).toEqual({ updated: 2 });

    for (const id of ids) {
      const req = await t.run(async (ctx: any) => await ctx.db.get(id));
      expect(req.status).toBe("approved");
    }
  });

  test("returns updated count of 0 for empty array", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.mutation(apiAny.requirements.bulkUpdateStatus, {
      requirementIds: [],
      status: "approved",
    });

    expect(result).toEqual({ updated: 0 });
  });
});

// ── bulkUpdatePriority ──────────────────────────────────────────────

describe("requirements.bulkUpdatePriority", () => {
  test("updates priority for all selected requirements", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const ids = await t.run(async (ctx: any) => {
      const id1 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Priority 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      const id2 = await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-002",
        title: "Priority 2",
        priority: "must_have",
        fitGap: "config",
        status: "draft",
      });
      return [id1, id2];
    });

    const result = await asUser.mutation(apiAny.requirements.bulkUpdatePriority, {
      requirementIds: ids,
      priority: "should_have",
    });

    expect(result).toEqual({ updated: 2 });

    for (const id of ids) {
      const req = await t.run(async (ctx: any) => await ctx.db.get(id));
      expect(req.priority).toBe("should_have");
    }
  });
});
