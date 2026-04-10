import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

/**
 * Integration tests for GitHub source control integration:
 * - Webhook event buffering (store raw events)
 * - Event status transitions (pending → processing → processed/failed)
 * - Installation → org resolution
 * - PR tracking data model
 * - Commit tracking linked to PRs and tasks
 * - Retry queue mechanics
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedOrg(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "gh-test-user",
      email: "gh@example.com",
      name: "GH Test User",
      orgIds: ["org-gh"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-gh",
      name: "GH Program",
      clientName: "GH Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const installationId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("sourceControlInstallations", {
      orgId: "org-gh",
      providerType: "github",
      installationId: "inst-12345",
      accountLogin: "test-org",
      accountType: "organization",
      status: "active",
      permissions: { contents: "read", pull_requests: "write" },
      installedAt: Date.now(),
    });
  });

  return { userId, programId, installationId };
}

async function seedRepository(t: any, programId: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("sourceControlRepositories", {
      orgId: "org-gh",
      programId,
      installationId: "inst-12345",
      providerType: "github",
      repoFullName: "test-org/test-repo",
      providerRepoId: "repo-456",
      defaultBranch: "main",
      language: "TypeScript",
      role: "storefront",
      isMonorepo: false,
    });
  });
}

// ── Webhook Event Buffering ─────────────────────────────────────────

describe("github-integration: webhook event buffering", () => {
  test("stores raw webhook event with pending status", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const eventId = await t.mutation(internalAny.sourceControl.webhooks.handler.storeEvent, {
      orgId: "org-gh",
      providerType: "github",
      eventType: "push",
      entityType: "push",
      entityId: "test-org/test-repo@refs/heads/main",
      payload: {
        ref: "refs/heads/main",
        commits: [{ id: "abc123", message: "test commit" }],
      },
    });

    expect(eventId).toBeDefined();

    const event = await t.run(async (ctx: any) => {
      return await ctx.db.get(eventId);
    });

    expect(event.status).toBe("pending");
    expect(event.retryCount).toBe(0);
    expect(event.eventType).toBe("push");
    expect(event.entityType).toBe("push");
    expect(event.providerType).toBe("github");
    expect(event.payload.commits).toHaveLength(1);
  });

  test("stores event with action field for PR events", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const eventId = await t.mutation(internalAny.sourceControl.webhooks.handler.storeEvent, {
      orgId: "org-gh",
      providerType: "github",
      eventType: "pull_request",
      action: "opened",
      entityType: "pull_request",
      entityId: "test-org/test-repo#42",
      payload: {
        action: "opened",
        number: 42,
        pull_request: { title: "Fix bug" },
      },
    });

    const event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.action).toBe("opened");
    expect(event.entityId).toBe("test-org/test-repo#42");
  });
});

// ── Event Status Transitions ────────────────────────────────────────

describe("github-integration: event status transitions", () => {
  test("transitions event from pending → processing → processed", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const eventId = await t.mutation(internalAny.sourceControl.webhooks.handler.storeEvent, {
      orgId: "org-gh",
      providerType: "github",
      eventType: "push",
      entityType: "push",
      entityId: "test-org/test-repo@refs/heads/main",
      payload: { ref: "refs/heads/main" },
    });

    // Mark processing
    await t.mutation(internalAny.sourceControl.webhooks.handler.updateEventStatus, {
      eventId,
      status: "processing",
    });

    let event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.status).toBe("processing");

    // Mark processed
    await t.mutation(internalAny.sourceControl.webhooks.handler.updateEventStatus, {
      eventId,
      status: "processed",
      processedAt: Date.now(),
    });

    event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.status).toBe("processed");
    expect(event.processedAt).toBeDefined();
  });

  test("transitions event to failed with retry count", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const eventId = await t.mutation(internalAny.sourceControl.webhooks.handler.storeEvent, {
      orgId: "org-gh",
      providerType: "github",
      eventType: "push",
      entityType: "push",
      entityId: "test-org/test-repo@refs/heads/main",
      payload: {},
    });

    await t.mutation(internalAny.sourceControl.webhooks.handler.updateEventStatus, {
      eventId,
      status: "failed",
      retryCount: 1,
    });

    const event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.status).toBe("failed");
    expect(event.retryCount).toBe(1);
  });

  test("marks event as filtered for irrelevant events", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const eventId = await t.mutation(internalAny.sourceControl.webhooks.handler.storeEvent, {
      orgId: "org-gh",
      providerType: "github",
      eventType: "star",
      entityType: "star",
      entityId: "test-org/test-repo",
      payload: { action: "created" },
    });

    await t.mutation(internalAny.sourceControl.webhooks.handler.updateEventStatus, {
      eventId,
      status: "filtered",
    });

    const event = await t.run(async (ctx: any) => await ctx.db.get(eventId));
    expect(event.status).toBe("filtered");
  });
});

// ── Installation → Org Resolution ───────────────────────────────────

describe("github-integration: installation resolution", () => {
  test("resolves orgId from installation ID", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const orgId = await t.query(
      internalAny.sourceControl.webhooks.handler.resolveOrgFromInstallation,
      { installationId: "inst-12345" },
    );

    expect(orgId).toBe("org-gh");
  });

  test("returns null for unknown installation ID", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.query(
      internalAny.sourceControl.webhooks.handler.resolveOrgFromInstallation,
      { installationId: "inst-nonexistent" },
    );

    expect(orgId).toBeNull();
  });
});

// ── PR Tracking ─────────────────────────────────────────────────────

describe("github-integration: PR tracking", () => {
  test("stores and retrieves PR with full metadata", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrg(t);
    const repoId = await seedRepository(t, programId);

    const prId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlPullRequests", {
        orgId: "org-gh",
        repositoryId: repoId,
        prNumber: 42,
        title: "Fix authentication bug",
        body: "Resolves issue with JWT validation",
        state: "open",
        isDraft: false,
        authorLogin: "developer1",
        sourceBranch: "fix/auth-bug",
        targetBranch: "main",
        reviewState: "pending",
        ciStatus: "passing",
        commitCount: 3,
        filesChanged: 5,
        additions: 120,
        deletions: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        providerUrl: "https://github.com/test-org/test-repo/pull/42",
      });
    });

    const pr = await t.run(async (ctx: any) => await ctx.db.get(prId));
    expect(pr.prNumber).toBe(42);
    expect(pr.state).toBe("open");
    expect(pr.reviewState).toBe("pending");
    expect(pr.ciStatus).toBe("passing");
  });

  test("links PR to task", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrg(t);
    const repoId = await seedRepository(t, programId);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-gh",
        programId,
        title: "Implement feature",
        priority: "high",
        status: "in_progress",
      });
    });

    const prId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlPullRequests", {
        orgId: "org-gh",
        repositoryId: repoId,
        prNumber: 43,
        taskId,
        linkMethod: "branch_name",
        linkConfidence: 0.95,
        title: "feat: implement feature",
        state: "open",
        isDraft: false,
        authorLogin: "developer1",
        sourceBranch: "feat/implement-feature",
        targetBranch: "main",
        reviewState: "none",
        ciStatus: "pending",
        commitCount: 1,
        filesChanged: 2,
        additions: 50,
        deletions: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        providerUrl: "https://github.com/test-org/test-repo/pull/43",
      });
    });

    const pr = await t.run(async (ctx: any) => await ctx.db.get(prId));
    expect(pr.taskId).toBe(taskId);
    expect(pr.linkMethod).toBe("branch_name");
    expect(pr.linkConfidence).toBe(0.95);
  });
});

// ── Commit Tracking ─────────────────────────────────────────────────

describe("github-integration: commit tracking", () => {
  test("stores commits linked to PR and task", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrg(t);
    const repoId = await seedRepository(t, programId);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-gh",
        programId,
        title: "Task with commits",
        priority: "medium",
        status: "in_progress",
      });
    });

    const prId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlPullRequests", {
        orgId: "org-gh",
        repositoryId: repoId,
        prNumber: 44,
        taskId,
        title: "PR with commits",
        state: "open",
        isDraft: false,
        authorLogin: "dev",
        sourceBranch: "feat/x",
        targetBranch: "main",
        reviewState: "none",
        ciStatus: "none",
        commitCount: 2,
        filesChanged: 3,
        additions: 100,
        deletions: 20,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        providerUrl: "https://github.com/test-org/test-repo/pull/44",
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sourceControlCommits", {
        orgId: "org-gh",
        repositoryId: repoId,
        sha: "abc123def456",
        prId,
        taskId,
        authorLogin: "dev",
        message: "feat: initial implementation",
        filesChanged: 2,
        additions: 80,
        deletions: 10,
        committedAt: Date.now() - 60000,
      });
      await ctx.db.insert("sourceControlCommits", {
        orgId: "org-gh",
        repositoryId: repoId,
        sha: "def456ghi789",
        prId,
        taskId,
        authorLogin: "dev",
        message: "fix: address review comments",
        filesChanged: 1,
        additions: 20,
        deletions: 10,
        committedAt: Date.now(),
      });
    });

    const commits = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("sourceControlCommits")
        .withIndex("by_pr", (q: any) => q.eq("prId", prId))
        .collect();
    });

    expect(commits).toHaveLength(2);
    expect(commits[0].taskId).toBe(taskId);
  });
});

// ── Retry Queue ─────────────────────────────────────────────────────

describe("github-integration: retry queue", () => {
  test("stores failed operation in retry queue", async () => {
    const t = convexTest(schema, modules);

    const retryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlRetryQueue", {
        orgId: "org-gh",
        operationType: "process_push_event",
        payload: { eventId: "evt-123", ref: "refs/heads/main" },
        retryCount: 0,
        nextRetryAt: Date.now() + 60000,
        lastError: "GitHub API rate limited",
        status: "pending",
        maxRetries: 5,
        createdAt: Date.now(),
      });
    });

    const retry = await t.run(async (ctx: any) => await ctx.db.get(retryId));
    expect(retry.status).toBe("pending");
    expect(retry.retryCount).toBe(0);
    expect(retry.maxRetries).toBe(5);
  });

  test("marks operation as abandoned after max retries", async () => {
    const t = convexTest(schema, modules);

    const retryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlRetryQueue", {
        orgId: "org-gh",
        operationType: "process_push_event",
        payload: {},
        retryCount: 5,
        nextRetryAt: Date.now(),
        lastError: "Persistent failure",
        status: "abandoned",
        maxRetries: 5,
        createdAt: Date.now() - 3600000,
      });
    });

    const retry = await t.run(async (ctx: any) => await ctx.db.get(retryId));
    expect(retry.status).toBe("abandoned");
    expect(retry.retryCount).toBe(5);
  });
});

// ── Deployment Tracking ─────────────────────────────────────────────

describe("github-integration: deployment tracking", () => {
  test("stores deployment with full metadata", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedOrg(t);
    const repoId = await seedRepository(t, programId);

    const deployId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlDeployments", {
        orgId: "org-gh",
        repositoryId: repoId,
        programId,
        environment: "production",
        rawEnvironment: "production",
        status: "success",
        sha: "abc123",
        ref: "refs/heads/main",
        deployedAt: Date.now(),
        deployedBy: "github-actions",
        completedAt: Date.now(),
        durationMs: 45000,
      });
    });

    const deploy = await t.run(async (ctx: any) => await ctx.db.get(deployId));
    expect(deploy.environment).toBe("production");
    expect(deploy.status).toBe("success");
    expect(deploy.durationMs).toBe(45000);
  });
});
