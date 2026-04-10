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
      sourcePlatform: "none",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  return { userId, programId };
}

// ── create ───────────────────────────────────────────────────────────

describe("playbooks.create", () => {
  test("creates a playbook with steps", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await asUser.mutation(apiAny.playbooks.create, {
      orgId: "org-1",
      programId: data.programId,
      name: "Migration Playbook",
      targetPlatform: "salesforce_b2b",
      steps: [{ title: "Step 1: Setup" }, { title: "Step 2: Migrate", estimatedHours: 8 }],
    });

    const playbook = await t.run(async (ctx: any) => await ctx.db.get(playbookId));
    expect(playbook.name).toBe("Migration Playbook");
    expect(playbook.status).toBe("draft");
    expect(playbook.steps).toHaveLength(2);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.playbooks.create, {
        orgId: "org-1",
        programId: data.programId,
        name: "Bad Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [],
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByProgram ────────────────────────────────────────────────────

describe("playbooks.listByProgram", () => {
  test("returns playbooks sorted by status then name", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Archived Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "archived",
      });
      await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Published Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "published",
      });
      await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Draft Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "draft",
      });
    });

    const playbooks = await asUser.query(apiAny.playbooks.listByProgram, {
      programId: data.programId,
    });
    expect(playbooks).toHaveLength(3);
    // Published first, then draft, then archived
    expect(playbooks[0].name).toBe("Published Playbook");
    expect(playbooks[1].name).toBe("Draft Playbook");
    expect(playbooks[2].name).toBe("Archived Playbook");
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Draft",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "draft",
      });
      await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Published",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "published",
      });
    });

    const playbooks = await asUser.query(apiAny.playbooks.listByProgram, {
      programId: data.programId,
      status: "draft",
    });
    expect(playbooks).toHaveLength(1);
    expect(playbooks[0].name).toBe("Draft");
  });
});

// ── publish ──────────────────────────────────────────────────────────

describe("playbooks.publish", () => {
  test("publishes a draft playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "My Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [{ title: "Step 1" }],
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.playbooks.publish, { playbookId });

    const playbook = await t.run(async (ctx: any) => await ctx.db.get(playbookId));
    expect(playbook.status).toBe("published");
  });

  test("rejects publishing non-draft playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Published",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "published",
      });
    });

    await expect(asUser.mutation(apiAny.playbooks.publish, { playbookId })).rejects.toThrow(
      "Only draft playbooks can be published",
    );
  });
});

// ── archive ──────────────────────────────────────────────────────────

describe("playbooks.archive", () => {
  test("archives a playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "My Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "published",
      });
    });

    await asUser.mutation(apiAny.playbooks.archive, { playbookId });

    const playbook = await t.run(async (ctx: any) => await ctx.db.get(playbookId));
    expect(playbook.status).toBe("archived");
  });
});

// ── instantiate ──────────────────────────────────────────────────────

describe("playbooks.instantiate", () => {
  test("creates instance with tasks from published playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [{ title: "Step 1" }, { title: "Step 2", description: "Details" }],
        status: "published",
      });
    });

    const instanceId = await asUser.mutation(apiAny.playbooks.instantiate, {
      playbookId,
      instanceName: "Sprint 1 Run",
    });

    const instance = await t.run(async (ctx: any) => await ctx.db.get(instanceId));
    expect(instance.name).toBe("Sprint 1 Run");
    expect(instance.status).toBe("active");
    expect(instance.generatedTaskIds).toHaveLength(2);

    // Verify tasks were created
    const tasks = await t.run(async (ctx: any) => {
      const taskIds = instance.generatedTaskIds;
      return Promise.all(taskIds.map((id: any) => ctx.db.get(id)));
    });
    expect(tasks[0].title).toBe("Step 1");
    expect(tasks[1].title).toBe("Step 2");
    expect(tasks[0].status).toBe("backlog");
  });

  test("rejects instantiating non-published playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Draft Playbook",
        targetPlatform: "salesforce_b2b",
        steps: [{ title: "Step" }],
        status: "draft",
      });
    });

    await expect(
      asUser.mutation(apiAny.playbooks.instantiate, {
        playbookId,
        instanceName: "Run",
      }),
    ).rejects.toThrow("Only published playbooks can be instantiated");
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("playbooks.remove", () => {
  test("removes a draft playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Draft",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.playbooks.remove, { playbookId });

    const playbook = await t.run(async (ctx: any) => await ctx.db.get(playbookId));
    expect(playbook).toBeNull();
  });

  test("rejects removing non-draft playbook", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const playbookId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("playbooks", {
        orgId: "org-1",
        programId: data.programId,
        name: "Published",
        targetPlatform: "salesforce_b2b",
        steps: [],
        status: "published",
      });
    });

    await expect(asUser.mutation(apiAny.playbooks.remove, { playbookId })).rejects.toThrow(
      "Only draft playbooks can be deleted",
    );
  });
});
