import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../../schema";
import { modules } from "../../../test.helpers";

async function setupAuthenticatedUser(t: any) {
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

  return { userId, programId, orgId: "org-1" };
}

describe("enqueueOperation", () => {
  test("creates a queue item with status pending", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const queueItemId = await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: { summary: "Test issue", description: "A test" },
      platformEntityId: "req-123",
    });

    expect(queueItemId).toBeDefined();

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item).toMatchObject({
      orgId: "org-1",
      programId,
      operationType: "create_issue",
      payload: { summary: "Test issue", description: "A test" },
      platformEntityId: "req-123",
      status: "pending",
    });
    expect(item.createdAt).toBeTypeOf("number");
  });

  test("throws without identity", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);

    await expect(
      t.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
        orgId,
        programId,
        operationType: "create_issue",
        payload: {},
        platformEntityId: "req-123",
      }),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("listQueueByProgram", () => {
  test("returns all items for a program", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: { summary: "Issue 1" },
      platformEntityId: "req-1",
    });
    await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "update_issue",
      payload: { summary: "Issue 2" },
      platformEntityId: "req-2",
    });

    const items = await asUser.query(apiAny.atlassian.jira.push.listQueueByProgram, { programId });

    expect(items).toHaveLength(2);
  });

  test("filters by status when provided", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId, userId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const queueItemId = await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: {},
      platformEntityId: "req-1",
    });

    // Approve one item
    await asUser.mutation(apiAny.atlassian.jira.push.reviewQueueItem, {
      queueItemId,
      decision: "approved",
      reviewUserId: userId,
    });

    // Add another pending item
    await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: {},
      platformEntityId: "req-2",
    });

    const pendingItems = await asUser.query(apiAny.atlassian.jira.push.listQueueByProgram, {
      programId,
      status: "pending",
    });
    expect(pendingItems).toHaveLength(1);

    const approvedItems = await asUser.query(apiAny.atlassian.jira.push.listQueueByProgram, {
      programId,
      status: "approved",
    });
    expect(approvedItems).toHaveLength(1);
  });

  test("returns empty array when no items", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const items = await asUser.query(apiAny.atlassian.jira.push.listQueueByProgram, { programId });
    expect(items).toHaveLength(0);
  });
});

describe("reviewQueueItem", () => {
  test("sets status to approved with reviewer info", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId, userId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const queueItemId = await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: {},
      platformEntityId: "req-1",
    });

    await asUser.mutation(apiAny.atlassian.jira.push.reviewQueueItem, {
      queueItemId,
      decision: "approved",
      reviewUserId: userId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("approved");
    expect(item.reviewedBy).toBe(userId);
    expect(item.reviewedAt).toBeTypeOf("number");
  });

  test("sets status to rejected", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId, userId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const queueItemId = await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: {},
      platformEntityId: "req-1",
    });

    await asUser.mutation(apiAny.atlassian.jira.push.reviewQueueItem, {
      queueItemId,
      decision: "rejected",
      reviewUserId: userId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("rejected");
  });

  test("throws for nonexistent item", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await setupAuthenticatedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Create a valid queue item to get a valid ID format, then delete it
    const queueItemId = await asUser.mutation(apiAny.atlassian.jira.push.enqueueOperation, {
      orgId: "org-1",
      programId,
      operationType: "create_issue",
      payload: {},
      platformEntityId: "req-1",
    });
    await t.run(async (ctx: any) => {
      await ctx.db.delete(queueItemId);
    });

    await expect(
      asUser.mutation(apiAny.atlassian.jira.push.reviewQueueItem, {
        queueItemId,
        decision: "approved",
        reviewUserId: userId,
      }),
    ).rejects.toThrow("Queue item not found");
  });
});

describe("markQueueItemExecuted", () => {
  test("marks item as executed", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);

    const queueItemId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId,
        programId,
        operationType: "create_issue",
        payload: {},
        platformEntityId: "req-1",
        status: "approved",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internalAny.atlassian.jira.push.markQueueItemExecuted, {
      queueItemId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.status).toBe("executed");
  });

  test("stores jiraResponse", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);

    const queueItemId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId,
        programId,
        operationType: "create_issue",
        payload: {},
        platformEntityId: "req-1",
        status: "approved",
        createdAt: Date.now(),
      });
    });

    const jiraResponse = {
      id: "10001",
      key: "PROJ-1",
      self: "https://jira.example.com/rest/api/2/issue/10001",
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
});

describe("enqueueOperationInternal", () => {
  test("creates queue item without auth check", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "create_sprint",
      payload: { name: "Sprint 1" },
      platformEntityId: "sprint-1",
    });

    expect(queueItemId).toBeDefined();

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item).toMatchObject({
      orgId: "org-1",
      programId,
      operationType: "create_sprint",
      payload: { name: "Sprint 1" },
      platformEntityId: "sprint-1",
      status: "pending",
    });
  });
});

describe("getQueueItemInternal", () => {
  test("returns queue item by ID", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupAuthenticatedUser(t);

    const queueItemId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId,
        programId,
        operationType: "add_comment",
        payload: { body: "A comment" },
        platformEntityId: "req-5",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const item = await t.query(internalAny.atlassian.jira.push.getQueueItemInternal, {
      queueItemId,
    });

    expect(item).toMatchObject({
      operationType: "add_comment",
      platformEntityId: "req-5",
      status: "pending",
    });
  });
});
