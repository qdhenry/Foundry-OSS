import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const api: any = (generatedApi as any).api;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedUser(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "test@test.com",
      name: "Test User",
      orgIds: ["org_test"],
      role: "admin",
    });
  });
}

interface SeedResult {
  programId: string;
  wsId: string;
}

async function seedProgramAndWorkstream(t: any): Promise<SeedResult> {
  let programId = "";
  let wsId = "";
  await t.run(async (ctx: any) => {
    programId = await ctx.db.insert("programs", {
      orgId: "org_test",
      name: "Test Program",
      clientName: "Acme",
      phase: "build",
      status: "active",
      slug: "test-program",
    });
    wsId = await ctx.db.insert("workstreams", {
      orgId: "org_test",
      programId,
      name: "Core Dev",
      shortCode: "WS-1",
      status: "on_track",
      sortOrder: 1,
    });
  });
  return { programId, wsId };
}

// ---------------------------------------------------------------------------
// sprints.getActive
// ---------------------------------------------------------------------------

describe("sprints.getActive", () => {
  it("returns the active sprint", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    let activeSprintId = "";
    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        name: "Sprint 1",
        number: 1,
        status: "completed",
      });
      activeSprintId = await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        name: "Sprint 2",
        number: 2,
        status: "active",
      });
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        name: "Sprint 3",
        number: 3,
        status: "planning",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.sprints.getActive, { programId });

    expect(result).not.toBeNull();
    expect(result._id).toBe(activeSprintId);
    expect(result.name).toBe("Sprint 2");
    expect(result.status).toBe("active");
  });

  it("returns null when no sprint is active", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        name: "Sprint 2",
        number: 2,
        status: "completed",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.sprints.getActive, { programId });

    expect(result).toBeNull();
  });

  it("returns null for program with no sprints", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId } = await seedProgramAndWorkstream(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.sprints.getActive, { programId });

    expect(result).toBeNull();
  });

  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId } = await seedProgramAndWorkstream(t);

    await expect(t.query(api.sprints.getActive, { programId })).rejects.toThrow();
  });
});
