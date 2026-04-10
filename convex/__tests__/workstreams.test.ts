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

  const otherUserId = await t.run(async (ctx: any) => {
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

  return { userId, otherUserId, programId, workstreamId };
}

describe("workstreams.listByProgram", () => {
  test("returns workstreams sorted by sortOrder", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId: data.programId,
        name: "Frontend",
        shortCode: "FE",
        status: "on_track",
        sortOrder: 3,
      });
      await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId: data.programId,
        name: "Integration",
        shortCode: "INT",
        status: "at_risk",
        sortOrder: 2,
      });
    });

    const workstreams = await asUser.query(apiAny.workstreams.listByProgram, {
      programId: data.programId,
    });
    expect(workstreams).toHaveLength(3);
    expect(workstreams[0].shortCode).toBe("BE"); // sortOrder 1
    expect(workstreams[1].shortCode).toBe("INT"); // sortOrder 2
    expect(workstreams[2].shortCode).toBe("FE"); // sortOrder 3
  });

  test("returns empty array for program with no workstreams", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const emptyProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Empty",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
      });
    });

    const workstreams = await asUser.query(apiAny.workstreams.listByProgram, {
      programId: emptyProgramId,
    });
    expect(workstreams).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.workstreams.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("workstreams.get", () => {
  test("returns single workstream", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const ws = await asUser.query(apiAny.workstreams.get, {
      workstreamId: data.workstreamId,
    });
    expect(ws.name).toBe("Backend");
    expect(ws.shortCode).toBe("BE");
    expect(ws.status).toBe("on_track");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.workstreams.get, {
        workstreamId: data.workstreamId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("workstreams.update", () => {
  test("updates name and status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.workstreams.update, {
      workstreamId: data.workstreamId,
      name: "Updated Backend",
      status: "at_risk",
    });

    const updated = await t.run(async (ctx: any) => await ctx.db.get(data.workstreamId));
    expect(updated.name).toBe("Updated Backend");
    expect(updated.status).toBe("at_risk");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.workstreams.update, {
        workstreamId: data.workstreamId,
        name: "Hacked",
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("workstreams.listByProgramInternal", () => {
  test("returns workstreams without auth", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const workstreams = await t.query(internalAny.workstreams.listByProgramInternal, {
      programId: data.programId,
    });
    expect(workstreams).toHaveLength(1);
    expect(workstreams[0].shortCode).toBe("BE");
    expect(workstreams[0].name).toBe("Backend");
  });
});
