import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../../convex/schema";
import { modules } from "../../../convex/test.helpers";

/**
 * Integration tests for cron jobs and scheduled functions:
 * - Health scoring data model readiness
 * - Dependency detection data model readiness
 * - Source control reconciliation data model
 * - Video retention cleanup data model
 *
 * Note: Cron jobs trigger internal actions that call external APIs (Claude, GitHub, etc.).
 * These tests validate the data model is correct for cron execution — the actual
 * scheduled action handlers are tested with mocked external services at the unit level.
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedCronEnv(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "cron-user",
      email: "cron@example.com",
      name: "Cron User",
      orgIds: ["org-cron"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-cron",
      name: "Cron Program",
      clientName: "Cron Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-cron",
      programId,
      name: "Backend",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  return { userId, programId, workstreamId, orgId: "org-cron" };
}

// ── Health Scoring ──────────────────────────────────────────────────

describe("cron-jobs: health scoring readiness", () => {
  test("health score data model supports cron output", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const scoreId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("aiHealthScores", {
        orgId: env.orgId,
        workstreamId: env.workstreamId,
        health: "on_track",
        healthScore: 85,
        reasoning: "Strong velocity, no blocking risks, all gates passing",
        factors: {
          velocityScore: 90,
          taskAgingScore: 80,
          riskScore: 85,
          gatePassRate: 100,
          dependencyScore: 75,
        },
        scheduledAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
    });

    const score = await t.run(async (ctx: any) => await ctx.db.get(scoreId));
    expect(score.health).toBe("on_track");
    expect(score.healthScore).toBe(85);
    expect(score.factors.velocityScore).toBe(90);
  });

  test("health score tracks status transitions", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const scoreId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("aiHealthScores", {
        orgId: env.orgId,
        workstreamId: env.workstreamId,
        health: "at_risk",
        healthScore: 55,
        reasoning: "Task aging increasing, 2 critical risks unmitigated",
        factors: {
          velocityScore: 60,
          taskAgingScore: 40,
          riskScore: 45,
          gatePassRate: 75,
          dependencyScore: 70,
        },
        previousHealth: "on_track",
        changeReason: "Velocity dropped below threshold after sprint 3",
        scheduledAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
    });

    const score = await t.run(async (ctx: any) => await ctx.db.get(scoreId));
    expect(score.previousHealth).toBe("on_track");
    expect(score.changeReason).toContain("Velocity dropped");
  });
});

// ── Dependency Detection ────────────────────────────────────────────

describe("cron-jobs: dependency detection readiness", () => {
  test("AI-detected dependencies are stored with confidence scores", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const ws2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreams", {
        orgId: env.orgId,
        programId: env.programId,
        name: "Frontend",
        shortCode: "FE",
        status: "on_track",
        sortOrder: 2,
      });
    });

    const depId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreamDependencies", {
        orgId: env.orgId,
        programId: env.programId,
        sourceWorkstreamId: ws2,
        targetWorkstreamId: env.workstreamId,
        description: "Frontend product page depends on backend API endpoints",
        status: "suggested",
        dependencyType: "blocks",
        suggestedBy: "ai",
        aiConfidence: 0.78,
      });
    });

    const dep = await t.run(async (ctx: any) => await ctx.db.get(depId));
    expect(dep.suggestedBy).toBe("ai");
    expect(dep.aiConfidence).toBe(0.78);
    expect(dep.status).toBe("suggested");
  });
});

// ── Source Control Reconciliation ────────────────────────────────────

describe("cron-jobs: source control reconciliation readiness", () => {
  test("sync state data model tracks reconciliation results", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const repoId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlRepositories", {
        orgId: env.orgId,
        programId: env.programId,
        installationId: "inst-cron",
        providerType: "github",
        repoFullName: "org/repo",
        providerRepoId: "repo-123",
        defaultBranch: "main",
        role: "storefront",
        isMonorepo: false,
      });
    });

    const syncId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlSyncState", {
        orgId: env.orgId,
        repositoryId: repoId,
        lastWebhookAt: Date.now() - 3600000,
        lastReconciliationAt: Date.now(),
        reconciliationCorrections: 2,
        status: "healthy",
      });
    });

    const sync = await t.run(async (ctx: any) => await ctx.db.get(syncId));
    expect(sync.status).toBe("healthy");
    expect(sync.reconciliationCorrections).toBe(2);
  });

  test("marks stale sync state for repos with no recent webhooks", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const repoId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlRepositories", {
        orgId: env.orgId,
        programId: env.programId,
        installationId: "inst-cron",
        providerType: "github",
        repoFullName: "org/stale-repo",
        providerRepoId: "repo-stale",
        defaultBranch: "main",
        role: "integration",
        isMonorepo: false,
      });
    });

    const syncId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlSyncState", {
        orgId: env.orgId,
        repositoryId: repoId,
        lastWebhookAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        lastReconciliationAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
        reconciliationCorrections: 0,
        status: "stale",
      });
    });

    const sync = await t.run(async (ctx: any) => await ctx.db.get(syncId));
    expect(sync.status).toBe("stale");
  });
});

// ── Video Retention Cleanup ─────────────────────────────────────────

describe("cron-jobs: video retention cleanup readiness", () => {
  test("identifies expired analyses for cleanup", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const docId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("documents", {
        orgId: env.orgId,
        programId: env.programId,
        fileName: "expired-call.mp4",
        fileType: "video/mp4",
        fileSize: 100_000_000,
        category: "meeting_notes",
        uploadedBy: env.userId,
      });
    });

    // Expired analysis
    await t.run(async (ctx: any) => {
      await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: docId,
        status: "complete",
        videoUrl: "https://example.com/expired.mp4",
        videoSizeBytes: 100_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: true,
        retentionPolicy: "30_days",
        retentionExpiresAt: Date.now() - 86400000, // Expired yesterday
        retentionStatus: "active",
        analysisVersion: 1,
      });
    });

    // Active analysis (not expired)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("videoAnalyses", {
        orgId: env.orgId,
        programId: env.programId,
        documentId: docId,
        status: "complete",
        videoUrl: "https://example.com/active.mp4",
        videoSizeBytes: 100_000_000,
        mimeType: "video/mp4",
        speakerMappingComplete: true,
        retentionPolicy: "60_days",
        retentionExpiresAt: Date.now() + 86400000 * 30, // 30 days from now
        retentionStatus: "active",
        analysisVersion: 1,
      });
    });

    // Query for expired analyses using the retention index
    const expired = await t.run(async (ctx: any) => {
      const all = await ctx.db.query("videoAnalyses").withIndex("by_retention").collect();
      return all.filter(
        (a: any) =>
          a.retentionExpiresAt &&
          a.retentionExpiresAt < Date.now() &&
          a.retentionStatus === "active",
      );
    });

    expect(expired).toHaveLength(1);
    expect(expired[0].retentionPolicy).toBe("30_days");
  });
});

// ── Presence System ─────────────────────────────────────────────────

describe("cron-jobs: presence heartbeat", () => {
  test("stores and updates user presence on page", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    const presenceId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("presence", {
        orgId: env.orgId,
        programId: env.programId,
        page: "discovery",
        userId: env.userId,
        userName: "Cron User",
        lastSeenAt: Date.now(),
      });
    });

    // Update heartbeat
    await t.run(async (ctx: any) => {
      await ctx.db.patch(presenceId, { lastSeenAt: Date.now() + 5000 });
    });

    const presence = await t.run(async (ctx: any) => await ctx.db.get(presenceId));
    expect(presence.page).toBe("discovery");
    expect(presence.lastSeenAt).toBeDefined();
  });

  test("queries presence by program and page", async () => {
    const t = convexTest(schema, modules);
    const env = await seedCronEnv(t);

    // Two users on same page
    await t.run(async (ctx: any) => {
      await ctx.db.insert("presence", {
        orgId: env.orgId,
        programId: env.programId,
        page: "mission-control",
        userId: env.userId,
        userName: "Cron User",
        lastSeenAt: Date.now(),
      });
    });

    const user2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "cron-user-2",
        email: "cron2@example.com",
        name: "Cron User 2",
        orgIds: ["org-cron"],
        role: "developer",
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("presence", {
        orgId: env.orgId,
        programId: env.programId,
        page: "mission-control",
        userId: user2Id,
        userName: "Cron User 2",
        lastSeenAt: Date.now(),
      });
    });

    const pagePresence = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("presence")
        .withIndex("by_program_page", (q: any) =>
          q.eq("programId", env.programId).eq("page", "mission-control"),
        )
        .collect();
    });

    expect(pagePresence).toHaveLength(2);
  });
});
