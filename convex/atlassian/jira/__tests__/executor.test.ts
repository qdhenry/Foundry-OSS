import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../../schema";
import { modules } from "../../../testing/convexModules.test";

async function setupExecutorTestData(t: any) {
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
      jiraSyncMode: "auto",
    });
  });

  return { userId, programId, orgId: "org-1" };
}

describe("executor queue item processing", () => {
  test("getQueueItemInternal retrieves a seeded queue item", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    const queueItemId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId,
        programId,
        operationType: "create_issue",
        payload: {
          fields: {
            project: { id: "10000" },
            summary: "[OM] Order Management",
            issuetype: { name: "Epic" },
          },
          platformEntityType: "workstream",
        },
        platformEntityId: "ws-123",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const item = await t.query(internalAny.atlassian.jira.push.getQueueItemInternal, {
      queueItemId,
    });

    expect(item).toBeTruthy();
    expect(item?.operationType).toBe("create_issue");
    expect(item?.payload.fields.issuetype.name).toBe("Epic");
    expect(item?.platformEntityId).toBe("ws-123");
  });

  test("markQueueItemExecuted marks item as executed with jiraResponse", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    const queueItemId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId,
        programId,
        operationType: "create_issue",
        payload: {
          fields: {
            project: { id: "10000" },
            summary: "[REQ-001] Order Processing",
            issuetype: { name: "Story" },
          },
          platformEntityType: "requirement",
        },
        platformEntityId: "req-001",
        status: "approved",
        createdAt: Date.now(),
      });
    });

    const jiraResponse = {
      id: "10001",
      key: "SCRUM-1",
      self: "https://test.atlassian.net/rest/api/3/issue/10001",
    };

    await t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
      queueItemId,
      jiraResponse,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("executed");
    expect(item.jiraResponse).toEqual(jiraResponse);
  });

  test("upsertSyncRecordInternal creates sync record for create_issue", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    const syncRecordId = await t.mutation(
      internalAny.atlassian.jira.sync.upsertSyncRecordInternal,
      {
        orgId,
        programId,
        platformEntityType: "workstream",
        platformEntityId: "ws-123",
        jiraIssueId: "10001",
        jiraIssueKey: "SCRUM-1",
        jiraIssueType: "Epic",
        syncDirection: "push",
        lastPushAt: Date.now(),
        conflictStatus: "none",
      },
    );

    expect(syncRecordId).toBeDefined();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });

    expect(record).toMatchObject({
      orgId: "org-1",
      programId,
      platformEntityType: "workstream",
      platformEntityId: "ws-123",
      jiraIssueId: "10001",
      jiraIssueKey: "SCRUM-1",
      jiraIssueType: "Epic",
      syncDirection: "push",
      conflictStatus: "none",
    });
  });

  test("upsertSyncRecordInternal updates existing record when jiraIssueKey matches", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    // Create initial record
    const syncRecordId = await t.mutation(
      internalAny.atlassian.jira.sync.upsertSyncRecordInternal,
      {
        orgId,
        programId,
        platformEntityType: "requirement",
        platformEntityId: "req-001",
        jiraIssueId: "10002",
        jiraIssueKey: "SCRUM-2",
        jiraIssueType: "Story",
        syncDirection: "push",
        lastPushAt: Date.now(),
        conflictStatus: "none",
      },
    );

    // Upsert with same jiraIssueKey should update, not create
    const updatedId = await t.mutation(internalAny.atlassian.jira.sync.upsertSyncRecordInternal, {
      orgId,
      programId,
      platformEntityType: "requirement",
      platformEntityId: "req-001",
      jiraIssueId: "10002",
      jiraIssueKey: "SCRUM-2",
      jiraIssueType: "Story",
      syncDirection: "bidirectional",
      lastPushAt: Date.now(),
      conflictStatus: "none",
    });

    expect(updatedId).toBe(syncRecordId);

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });

    expect(record.syncDirection).toBe("bidirectional");
  });

  test("markQueueItemExecuted throws for nonexistent queue item", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    // Create then delete a queue item to get a valid-format ID
    const queueItemId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId,
        programId,
        operationType: "create_issue",
        payload: {},
        platformEntityId: "req-1",
        status: "pending",
        createdAt: Date.now(),
      });
    });
    await t.run(async (ctx: any) => {
      await ctx.db.delete(queueItemId);
    });

    await expect(
      t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
        queueItemId,
      }),
    ).rejects.toThrow("Queue item not found");
  });
});

describe("executor end-to-end flow simulation", () => {
  test("full create_issue flow: enqueue → mark executed → create sync record", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    // Step 1: Enqueue a create_issue operation (simulating mapper output)
    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: {
        fields: {
          project: { id: "10000" },
          summary: "[REQ-001] Order Processing",
          issuetype: { name: "Story" },
          priority: { name: "Highest" },
        },
        platformEntityType: "requirement",
      },
      platformEntityId: "req-001",
    });

    // Verify queue item was created
    const queueItem = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });
    expect(queueItem.status).toBe("pending");

    // Step 2: Simulate executor marking it as executed (after Jira API call)
    const jiraResponse = {
      id: "10001",
      key: "SCRUM-1",
      self: "https://test.atlassian.net/rest/api/3/issue/10001",
    };

    await t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
      queueItemId,
      jiraResponse,
    });

    // Step 3: Simulate executor creating sync record
    const syncRecordId = await t.mutation(
      internalAny.atlassian.jira.sync.upsertSyncRecordInternal,
      {
        orgId,
        programId,
        platformEntityType: "requirement",
        platformEntityId: "req-001",
        jiraIssueId: jiraResponse.id,
        jiraIssueKey: jiraResponse.key,
        jiraIssueType: "Story",
        syncDirection: "push",
        lastPushAt: Date.now(),
        conflictStatus: "none",
      },
    );

    // Verify final state
    const executedItem = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });
    expect(executedItem.status).toBe("executed");
    expect(executedItem.jiraResponse).toEqual(jiraResponse);

    const syncRecord = await t.run(async (ctx: any) => {
      return await ctx.db.get(syncRecordId);
    });
    expect(syncRecord.jiraIssueKey).toBe("SCRUM-1");
    expect(syncRecord.platformEntityType).toBe("requirement");
    expect(syncRecord.syncDirection).toBe("push");
  });

  test("update_issue flow: enqueue update → mark executed", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "update_issue",
      payload: {
        issueKey: "SCRUM-1",
        fields: {
          summary: "[REQ-001] Updated Order Processing",
        },
      },
      platformEntityId: "req-001",
    });

    const jiraResponse = { ok: true };

    await t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
      queueItemId,
      jiraResponse,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("executed");
    expect(item.operationType).toBe("update_issue");
    expect(item.jiraResponse).toEqual({ ok: true });
  });

  test("transition_issue flow: enqueue transition → mark executed", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "transition_issue",
      payload: {
        issueKey: "SCRUM-1",
        transitionId: "31",
      },
      platformEntityId: "req-001",
    });

    await t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
      queueItemId,
      jiraResponse: { ok: true },
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("executed");
    expect(item.operationType).toBe("transition_issue");
  });

  test("add_comment flow: enqueue comment → mark executed", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupExecutorTestData(t);

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "add_comment",
      payload: {
        issueKey: "SCRUM-1",
        body: { type: "doc", version: 1, content: [] },
      },
      platformEntityId: "req-001",
    });

    await t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
      queueItemId,
      jiraResponse: { id: "comment-1" },
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("executed");
    expect(item.operationType).toBe("add_comment");
  });
});
