import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../../schema";
import type { ConvexTestModuleMap } from "../../../test.helpers";

// Vite's glob from __tests__ won't re-enter the atlassian/ directory when
// traversing up with ../../../. We grab a second glob and re-key entries so
// convex-test's findModulesRoot (prefix = ../../../) can resolve them.
type ImportMetaWithGlob = ImportMeta & {
  glob: (pattern: string) => ConvexTestModuleMap;
};

const importMetaWithGlob = import.meta as ImportMetaWithGlob;
const convexRoot = importMetaWithGlob.glob("../../../**/*.*s");
const atlassianTree = importMetaWithGlob.glob("../../**/*.*s");
function rekeyAtlassian(entries: ConvexTestModuleMap): ConvexTestModuleMap {
  const result: ConvexTestModuleMap = {};
  for (const [key, val] of Object.entries(entries)) {
    let newKey: string;
    if (key.startsWith("../../")) {
      newKey = key.replace("../../", "../../../atlassian/");
    } else if (key.startsWith("../")) {
      newKey = key.replace("../", "../../../atlassian/jira/");
    } else if (key.startsWith("./")) {
      newKey = key.replace("./", "../../../atlassian/jira/__tests__/");
    } else {
      newKey = key;
    }
    result[newKey] = val;
  }
  return result;
}
const modules: ConvexTestModuleMap = {
  ...convexRoot,
  ...rekeyAtlassian(atlassianTree),
};

// ── Helpers ──────────────────────────────────────────────────────────

async function setupTestData(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "test@example.com",
      name: "Test User",
      orgIds: ["org-1"],
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

  const connectionId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("atlassianConnections", {
      orgId: "org-1",
      programId,
      status: "connected",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return { userId, programId, connectionId, orgId: "org-1" };
}

function makeIssuePayload(overrides: Record<string, any> = {}) {
  return {
    issue: {
      id: "10001",
      key: "SCRUM-1",
      fields: {
        issuetype: { name: "Story" },
        updated: "2026-02-14T10:00:00.000Z",
      },
    },
    ...overrides,
  };
}

function makeStatusChangePayload(from: string, to: string, overrides: Record<string, any> = {}) {
  return makeIssuePayload({
    changelog: {
      items: [{ field: "status", fromString: from, toString: to }],
    },
    ...overrides,
  });
}

// ── handleJiraWebhookEvent ───────────────────────────────────────────

describe("handleJiraWebhookEvent", () => {
  test("returns processed:false when missing programId", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupTestData(t);

    const result = await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId: undefined,
      eventType: "jira:issue_updated",
      payload: makeIssuePayload(),
    });

    expect(result).toEqual({
      processed: false,
      reason: "missing programId or issue key",
    });
  });

  test("returns processed:false when missing issue key in payload", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const result = await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_updated",
      payload: { someField: "no issue here" },
    });

    expect(result).toEqual({
      processed: false,
      reason: "missing programId or issue key",
    });
  });

  test("creates new sync record for unknown Jira issue", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const result = await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_created",
      payload: makeIssuePayload(),
    });

    expect(result).toEqual({ processed: true, created: true });

    // Verify DB insert
    const records = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("jiraSyncRecords")
        .withIndex("by_jira_issue_key", (q: any) =>
          q.eq("programId", programId).eq("jiraIssueKey", "SCRUM-1"),
        )
        .collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].jiraIssueKey).toBe("SCRUM-1");
    expect(records[0].jiraIssueId).toBe("10001");
    expect(records[0].platformEntityType).toBe("task");
    expect(records[0].conflictStatus).toBe("none");
  });

  test("updates existing sync record on re-delivery", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    // Create initial sync record
    const syncRecordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "10001",
        jiraIssueId: "10001",
        jiraIssueKey: "SCRUM-1",
        jiraIssueType: "Story",
        syncDirection: "bidirectional",
        lastPullAt: 1000,
        conflictStatus: "none",
      });
    });

    const result = await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_updated",
      payload: makeIssuePayload(),
    });

    expect(result).toEqual({
      processed: true,
      created: false,
      statusSynced: false,
    });

    // Verify patch updated lastPullAt
    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });
    expect(updated.lastPullAt).toBeGreaterThan(1000);
  });

  test("detects status change from changelog and maps correctly", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    // Create existing sync record linked to a requirement
    const requirementId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId,
        programId,
        refId: "REQ-001",
        title: "Test Requirement",
        priority: "must_have",
        fitGap: "custom_dev",
        status: "draft",
      });
    });

    await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "requirement",
        platformEntityId: requirementId,
        jiraIssueId: "10001",
        jiraIssueKey: "SCRUM-1",
        jiraIssueType: "Story",
        syncDirection: "bidirectional",
        lastPullAt: Date.now(),
        conflictStatus: "none",
      });
    });

    await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_updated",
      payload: makeStatusChangePayload("To Do", "In Progress"),
    });

    // Verify requirement status was updated
    const requirement = await t.run(async (ctx: any) => {
      return await ctx.db.get(requirementId);
    });
    expect(requirement.status).toBe("in_progress");
  });

  test("detects conflict when platformLastModified > lastPullAt", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const now = Date.now();
    const syncRecordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "requirement",
        platformEntityId: "some-entity-id",
        jiraIssueId: "10001",
        jiraIssueKey: "SCRUM-1",
        jiraIssueType: "Story",
        syncDirection: "bidirectional",
        lastPullAt: now - 10000,
        platformLastModified: now - 5000, // Modified AFTER lastPullAt
        conflictStatus: "none",
      });
    });

    await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_updated",
      payload: makeStatusChangePayload("To Do", "Done"),
    });

    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });
    expect(updated.conflictStatus).toBe("detected");
    expect(updated.conflictDetails).toContain("Concurrent edit detected");
  });

  test("does NOT flag conflict when platformLastModified <= lastPullAt", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const now = Date.now();
    const syncRecordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "some-entity-id",
        jiraIssueId: "10001",
        jiraIssueKey: "SCRUM-1",
        jiraIssueType: "Story",
        syncDirection: "bidirectional",
        lastPullAt: now - 5000,
        platformLastModified: now - 10000, // Modified BEFORE lastPullAt
        conflictStatus: "none",
      });
    });

    await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_updated",
      payload: makeStatusChangePayload("To Do", "In Progress"),
    });

    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });
    expect(updated.conflictStatus).toBe("none");
  });

  test("updates connection lastSyncAt", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, connectionId } = await setupTestData(t);

    await t.mutation(internalAny.atlassian.jira.sync.handleJiraWebhookEvent, {
      orgId,
      programId,
      eventType: "jira:issue_created",
      payload: makeIssuePayload(),
    });

    const connection = await t.run(async (ctx: any) => {
      return await ctx.db.get(connectionId);
    });
    expect(connection.lastSyncAt).toBeDefined();
    expect(connection.lastSyncAt).toBeGreaterThan(0);
  });
});

// ── resolveConflict ──────────────────────────────────────────────────

describe("resolveConflict", () => {
  test("resolves with keep_jira - sets conflictStatus to resolved", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const syncRecordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-1",
        jiraIssueKey: "SCRUM-1",
        syncDirection: "bidirectional",
        conflictStatus: "detected",
        conflictDetails: "Concurrent edit detected",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(apiAny.atlassian.jira.sync.resolveConflict, {
      syncRecordId,
      resolution: "keep_jira",
    });

    expect(result).toEqual({ resolved: true, resolution: "keep_jira" });

    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });
    expect(updated.conflictStatus).toBe("resolved");
    expect(updated.conflictDetails).toContain("kept Jira version");
  });

  test("resolves with keep_platform - sets conflictStatus to resolved", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const syncRecordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-1",
        jiraIssueKey: "SCRUM-1",
        syncDirection: "bidirectional",
        conflictStatus: "detected",
        conflictDetails: "Concurrent edit detected",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(apiAny.atlassian.jira.sync.resolveConflict, {
      syncRecordId,
      resolution: "keep_platform",
    });

    expect(result).toEqual({ resolved: true, resolution: "keep_platform" });

    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });
    expect(updated.conflictStatus).toBe("resolved");
    expect(updated.conflictDetails).toContain("kept platform version");
  });

  test("throws when no conflict detected on sync record", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const syncRecordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-1",
        jiraIssueKey: "SCRUM-1",
        syncDirection: "bidirectional",
        conflictStatus: "none",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    await expect(
      asUser.mutation(apiAny.atlassian.jira.sync.resolveConflict, {
        syncRecordId,
        resolution: "keep_jira",
      }),
    ).rejects.toThrow("No conflict to resolve");
  });

  test("throws for nonexistent sync record", async () => {
    const t = convexTest(schema, modules);
    await setupTestData(t);

    // Use a valid-looking but nonexistent ID
    const fakeId = await t.run(async (ctx: any) => {
      // Insert and delete to get a valid ID format that no longer exists
      const id = await ctx.db.insert("jiraSyncRecords", {
        orgId: "org-1",
        programId: (await ctx.db.query("programs").first())._id,
        platformEntityType: "task",
        platformEntityId: "temp",
        syncDirection: "bidirectional",
        conflictStatus: "none",
      });
      await ctx.db.delete(id);
      return id;
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    await expect(
      asUser.mutation(apiAny.atlassian.jira.sync.resolveConflict, {
        syncRecordId: fakeId,
        resolution: "keep_jira",
      }),
    ).rejects.toThrow("Sync record not found");
  });
});

// ── upsertSyncRecord ────────────────────────────────────────────────

describe("upsertSyncRecord", () => {
  test("creates new sync record", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const id = await asUser.mutation(apiAny.atlassian.jira.sync.upsertSyncRecord, {
      orgId,
      programId,
      platformEntityType: "requirement",
      platformEntityId: "entity-123",
      jiraIssueKey: "SCRUM-5",
      syncDirection: "push",
    });

    expect(id).toBeDefined();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(id);
    });
    expect(record.jiraIssueKey).toBe("SCRUM-5");
    expect(record.platformEntityType).toBe("requirement");
    expect(record.syncDirection).toBe("push");
  });

  test("updates existing by jiraIssueKey", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    // Insert existing record
    const existingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "requirement",
        platformEntityId: "entity-123",
        jiraIssueKey: "SCRUM-5",
        syncDirection: "push",
        conflictStatus: "none",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const returnedId = await asUser.mutation(apiAny.atlassian.jira.sync.upsertSyncRecord, {
      orgId,
      programId,
      platformEntityType: "requirement",
      platformEntityId: "entity-123",
      jiraIssueKey: "SCRUM-5",
      jiraIssueId: "99999",
      syncDirection: "bidirectional",
    });

    expect(returnedId).toEqual(existingId);

    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(existingId);
    });
    expect(updated.jiraIssueId).toBe("99999");
    expect(updated.syncDirection).toBe("bidirectional");
  });

  test("updates existing by platformEntity when no jiraIssueKey", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    const existingId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "task-abc",
        syncDirection: "push",
        conflictStatus: "none",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const returnedId = await asUser.mutation(apiAny.atlassian.jira.sync.upsertSyncRecord, {
      orgId,
      programId,
      platformEntityType: "task",
      platformEntityId: "task-abc",
      jiraIssueId: "55555",
      syncDirection: "bidirectional",
    });

    expect(returnedId).toEqual(existingId);

    const updated = await t.run(async (ctx: any) => {
      return await ctx.db.get(existingId);
    });
    expect(updated.jiraIssueId).toBe("55555");
  });
});

// ── listConflictsByProgram ──────────────────────────────────────────

describe("listConflictsByProgram", () => {
  test("returns only records with conflictStatus detected", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    // Insert records with different conflict statuses
    await t.run(async (ctx: any) => {
      await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-1",
        jiraIssueKey: "SCRUM-1",
        syncDirection: "bidirectional",
        conflictStatus: "detected",
        conflictDetails: "Conflict 1",
      });
      await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-2",
        jiraIssueKey: "SCRUM-2",
        syncDirection: "bidirectional",
        conflictStatus: "none",
      });
      await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-3",
        jiraIssueKey: "SCRUM-3",
        syncDirection: "bidirectional",
        conflictStatus: "resolved",
      });
      await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-4",
        jiraIssueKey: "SCRUM-4",
        syncDirection: "bidirectional",
        conflictStatus: "detected",
        conflictDetails: "Conflict 2",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const conflicts = await asUser.query(apiAny.atlassian.jira.sync.listConflictsByProgram, {
      programId,
    });

    expect(conflicts).toHaveLength(2);
    expect(conflicts.every((c: any) => c.conflictStatus === "detected")).toBe(true);
  });

  test("returns empty array when no conflicts", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("jiraSyncRecords", {
        orgId,
        programId,
        platformEntityType: "task",
        platformEntityId: "entity-1",
        jiraIssueKey: "SCRUM-1",
        syncDirection: "bidirectional",
        conflictStatus: "none",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const conflicts = await asUser.query(apiAny.atlassian.jira.sync.listConflictsByProgram, {
      programId,
    });

    expect(conflicts).toHaveLength(0);
  });
});
