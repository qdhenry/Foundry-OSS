import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../schema";
import { modules } from "../../test.helpers";

/**
 * Integration tests for Atlassian (Jira/Confluence) integration:
 * - Connection lifecycle (setup_required → connected → disconnected)
 * - Jira sync records (entity mapping)
 * - Confluence page records (publish/ingest tracking)
 * - Webhook event buffering
 * - Jira sync queue (approval workflow)
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedOrgWithProgram(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "atl-user-1",
      email: "atl@example.com",
      name: "Atlassian User",
      orgIds: ["org-atl"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-atl",
      name: "Atlassian Program",
      clientName: "Atl Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  return { userId, programId };
}

// ── Atlassian Connection Lifecycle ──────────────────────────────────

describe("atlassian-integration: connection lifecycle", () => {
  test("creates connection in setup_required status", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedOrgWithProgram(t);

    const connId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("atlassianConnections", {
        orgId: "org-atl",
        programId,
        status: "setup_required",
        connectedBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const conn = await t.run(async (ctx: any) => await ctx.db.get(connId));
    expect(conn.status).toBe("setup_required");
    expect(conn.orgId).toBe("org-atl");
  });

  test("transitions to connected with OAuth tokens", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedOrgWithProgram(t);

    const connId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("atlassianConnections", {
        orgId: "org-atl",
        programId,
        status: "setup_required",
        connectedBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Simulate OAuth callback completing
    await t.run(async (ctx: any) => {
      await ctx.db.patch(connId, {
        status: "connected",
        atlassianSiteId: "site-123",
        atlassianSiteUrl: "https://test.atlassian.net",
        accessTokenEncrypted: "encrypted-access-token",
        refreshTokenEncrypted: "encrypted-refresh-token",
        tokenExpiresAt: Date.now() + 3600000,
        scopes: ["read:jira-work", "write:jira-work", "read:confluence-content.all"],
        jiraProjectId: "10001",
        jiraProjectKey: "TEST",
        connectedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const conn = await t.run(async (ctx: any) => await ctx.db.get(connId));
    expect(conn.status).toBe("connected");
    expect(conn.atlassianSiteId).toBe("site-123");
    expect(conn.jiraProjectKey).toBe("TEST");
    expect(conn.accessTokenEncrypted).toBeDefined();
  });

  test("transitions to disconnected", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedOrgWithProgram(t);

    const connId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("atlassianConnections", {
        orgId: "org-atl",
        programId,
        status: "connected",
        atlassianSiteId: "site-123",
        connectedBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.patch(connId, {
        status: "disconnected",
        disconnectedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const conn = await t.run(async (ctx: any) => await ctx.db.get(connId));
    expect(conn.status).toBe("disconnected");
    expect(conn.disconnectedAt).toBeDefined();
  });
});

// ── Jira Sync Records ───────────────────────────────────────────────

describe("atlassian-integration: jira sync records", () => {
  test("creates sync record mapping task to Jira issue", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-atl",
        programId,
        title: "Synced task",
        priority: "high",
        status: "todo",
      });
    });

    const syncId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId: "org-atl",
        programId,
        platformEntityType: "task",
        platformEntityId: taskId,
        jiraIssueId: "10042",
        jiraIssueKey: "TEST-42",
        jiraIssueType: "Story",
        syncDirection: "push",
        lastPushAt: Date.now(),
        conflictStatus: "none",
      });
    });

    const sync = await t.run(async (ctx: any) => await ctx.db.get(syncId));
    expect(sync.jiraIssueKey).toBe("TEST-42");
    expect(sync.syncDirection).toBe("push");
    expect(sync.conflictStatus).toBe("none");
  });

  test("tracks bidirectional sync with conflict detection", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const syncId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncRecords", {
        orgId: "org-atl",
        programId,
        platformEntityType: "requirement",
        platformEntityId: "req-123",
        jiraIssueId: "10043",
        jiraIssueKey: "TEST-43",
        syncDirection: "bidirectional",
        lastPushAt: Date.now() - 60000,
        lastPullAt: Date.now(),
        conflictStatus: "detected",
        conflictDetails: "Title changed in both systems",
      });
    });

    const sync = await t.run(async (ctx: any) => await ctx.db.get(syncId));
    expect(sync.syncDirection).toBe("bidirectional");
    expect(sync.conflictStatus).toBe("detected");
    expect(sync.conflictDetails).toContain("Title changed");
  });
});

// ── Confluence Page Records ─────────────────────────────────────────

describe("atlassian-integration: confluence page records", () => {
  test("tracks published gap analysis page", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const pageId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("confluencePageRecords", {
        orgId: "org-atl",
        programId,
        pageType: "gap_analysis",
        confluencePageId: "conf-page-123",
        confluencePageTitle: "AcmeCorp - Gap Analysis",
        confluenceVersion: 1,
        direction: "publish",
        lastPublishedAt: Date.now(),
        contentHash: "sha256-abc123",
      });
    });

    const page = await t.run(async (ctx: any) => await ctx.db.get(pageId));
    expect(page.pageType).toBe("gap_analysis");
    expect(page.direction).toBe("publish");
    expect(page.confluenceVersion).toBe(1);
  });

  test("tracks ingested confluence page", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const pageId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("confluencePageRecords", {
        orgId: "org-atl",
        programId,
        pageType: "ingested",
        confluencePageId: "conf-page-456",
        confluencePageTitle: "Client Architecture Doc",
        confluenceVersion: 3,
        direction: "ingest",
        lastIngestedAt: Date.now(),
      });
    });

    const page = await t.run(async (ctx: any) => await ctx.db.get(pageId));
    expect(page.direction).toBe("ingest");
    expect(page.pageType).toBe("ingested");
  });
});

// ── Atlassian Webhook Event Buffering ───────────────────────────────

describe("atlassian-integration: webhook event buffering", () => {
  test("stores Jira webhook event with pending status", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const eventId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("atlassianWebhookEvents", {
        orgId: "org-atl",
        programId,
        providerType: "jira",
        atlassianSiteId: "site-123",
        eventType: "jira:issue_updated",
        action: "status_changed",
        entityType: "issue",
        entityId: "TEST-42",
        payload: {
          issue: { key: "TEST-42", fields: { status: { name: "Done" } } },
        },
        status: "pending",
        retryCount: 0,
        receivedAt: Date.now(),
      });
    });

    const event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.status).toBe("pending");
    expect(event.providerType).toBe("jira");
    expect(event.entityId).toBe("TEST-42");
  });

  test("stores Confluence webhook event", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const eventId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("atlassianWebhookEvents", {
        orgId: "org-atl",
        programId,
        providerType: "confluence",
        atlassianSiteId: "site-123",
        eventType: "page_updated",
        entityType: "page",
        entityId: "conf-page-456",
        payload: {
          page: { id: "conf-page-456", title: "Updated Doc" },
        },
        status: "pending",
        retryCount: 0,
        receivedAt: Date.now(),
      });
    });

    const event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.providerType).toBe("confluence");
    expect(event.entityType).toBe("page");
  });
});

// ── Jira Sync Queue (Approval Workflow) ─────────────────────────────

describe("atlassian-integration: jira sync queue", () => {
  test("queues create_issue operation for approval", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrgWithProgram(t);

    const queueId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId: "org-atl",
        programId,
        operationType: "create_issue",
        payload: {
          summary: "New requirement: Product catalog migration",
          issueType: "Story",
          projectKey: "TEST",
        },
        platformEntityId: "req-001",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const item = await t.run(async (ctx: any) => await ctx.db.get(queueId));
    expect(item.status).toBe("pending");
    expect(item.operationType).toBe("create_issue");
  });

  test("transitions through approval workflow", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedOrgWithProgram(t);

    const queueId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId: "org-atl",
        programId,
        operationType: "transition_issue",
        payload: { issueKey: "TEST-42", targetStatus: "Done" },
        platformEntityId: "task-001",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    // Approve
    await t.run(async (ctx: any) => {
      await ctx.db.patch(queueId, {
        status: "approved",
        reviewedBy: userId,
        reviewedAt: Date.now(),
      });
    });

    // Execute
    await t.run(async (ctx: any) => {
      await ctx.db.patch(queueId, {
        status: "executed",
        jiraResponse: { status: "200", transitionId: "31" },
      });
    });

    const item = await t.run(async (ctx: any) => await ctx.db.get(queueId));
    expect(item.status).toBe("executed");
    expect(item.reviewedBy).toBe(userId);
    expect(item.jiraResponse).toBeDefined();
  });

  test("rejects sync operation", async () => {
    const t = convexTest(schema, modules);
    const { userId, programId } = await seedOrgWithProgram(t);

    const queueId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jiraSyncQueue", {
        orgId: "org-atl",
        programId,
        operationType: "update_issue",
        payload: { issueKey: "TEST-43", summary: "Updated title" },
        platformEntityId: "req-002",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.patch(queueId, {
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: Date.now(),
      });
    });

    const item = await t.run(async (ctx: any) => await ctx.db.get(queueId));
    expect(item.status).toBe("rejected");
  });
});
