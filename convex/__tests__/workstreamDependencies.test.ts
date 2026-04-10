import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: create a second workstream for dependency tests.
 */
async function createSecondWorkstream(t: any, programId: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Frontend Workstream",
      shortCode: "FE",
      status: "on_track",
      sortOrder: 2,
    });
  });
}

// ── create ──────────────────────────────────────────────────────────

describe("workstreamDependencies.create", () => {
  test("creates a dependency between workstreams", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
      description: "Backend blocks frontend",
      status: "active",
    });

    expect(depId).toBeTruthy();
  });

  test("rejects self-referencing dependency", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);

    await expect(
      asUser.mutation(apiAny.workstreamDependencies.create, {
        orgId,
        programId,
        sourceWorkstreamId: workstreamId,
        targetWorkstreamId: workstreamId,
      }),
    ).rejects.toThrow("Source and target workstreams must be different");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, workstreamId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    await expect(
      asOtherUser.mutation(apiAny.workstreamDependencies.create, {
        orgId: "org-1",
        programId,
        sourceWorkstreamId: workstreamId,
        targetWorkstreamId: targetWsId,
      }),
    ).rejects.toThrow();
  });
});

// ── listByProgram ───────────────────────────────────────────────────

describe("workstreamDependencies.listByProgram", () => {
  test("returns enriched dependencies for a program", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    const deps = await asUser.query(apiAny.workstreamDependencies.listByProgram, { programId });

    expect(deps).toHaveLength(1);
    expect(deps[0].sourceWorkstream?.shortCode).toBe("BE");
    expect(deps[0].targetWorkstream?.shortCode).toBe("FE");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.workstreamDependencies.listByProgram, {
        programId,
      }),
    ).rejects.toThrow();
  });
});

// ── listByWorkstream ────────────────────────────────────────────────

describe("workstreamDependencies.listByWorkstream", () => {
  test("returns dependencies where workstream is source or target", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    // Query from source side
    const fromSource = await asUser.query(apiAny.workstreamDependencies.listByWorkstream, {
      workstreamId,
    });
    expect(fromSource).toHaveLength(1);

    // Query from target side
    const fromTarget = await asUser.query(apiAny.workstreamDependencies.listByWorkstream, {
      workstreamId: targetWsId,
    });
    expect(fromTarget).toHaveLength(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, workstreamId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.workstreamDependencies.listByWorkstream, {
        workstreamId,
      }),
    ).rejects.toThrow();
  });
});

// ── update ──────────────────────────────────────────────────────────

describe("workstreamDependencies.update", () => {
  test("updates description and status", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    await asUser.mutation(apiAny.workstreamDependencies.update, {
      dependencyId: depId,
      description: "Updated desc",
      status: "resolved",
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(depId));
    expect(updated.description).toBe("Updated desc");
    expect(updated.status).toBe("resolved");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asUser, asOtherUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    await expect(
      asOtherUser.mutation(apiAny.workstreamDependencies.update, {
        dependencyId: depId,
        status: "blocked",
      }),
    ).rejects.toThrow();
  });
});

// ── updateStatus ────────────────────────────────────────────────────

describe("workstreamDependencies.updateStatus", () => {
  test("changes status with audit trail", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    await asUser.mutation(apiAny.workstreamDependencies.updateStatus, {
      dependencyId: depId,
      status: "blocked",
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(depId));
    expect(updated.status).toBe("blocked");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asUser, asOtherUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    await expect(
      asOtherUser.mutation(apiAny.workstreamDependencies.updateStatus, {
        dependencyId: depId,
        status: "resolved",
      }),
    ).rejects.toThrow();
  });
});

// ── remove ──────────────────────────────────────────────────────────

describe("workstreamDependencies.remove", () => {
  test("deletes a dependency", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    await asUser.mutation(apiAny.workstreamDependencies.remove, {
      dependencyId: depId,
    });

    const deleted = await t.run(async (ctx: any) => ctx.db.get(depId));
    expect(deleted).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asUser, asOtherUser, programId, workstreamId, orgId } = await setupTestEnv(t);
    const targetWsId = await createSecondWorkstream(t, programId);

    const depId = await asUser.mutation(apiAny.workstreamDependencies.create, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId: targetWsId,
    });

    await expect(
      asOtherUser.mutation(apiAny.workstreamDependencies.remove, {
        dependencyId: depId,
      }),
    ).rejects.toThrow();
  });
});
