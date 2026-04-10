import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../../schema";
import { modules } from "../../../test.helpers";

async function setupProgramWithWorkstreams(t: any) {
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

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Frontend",
      shortCode: "FE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  const workstreamId2 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Backend",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 2,
    });
  });

  const requirementId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-1",
      programId,
      workstreamId,
      refId: "REQ-001",
      title: "Product Catalog Migration",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "draft",
    });
  });

  const requirementId2 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-1",
      programId,
      workstreamId,
      refId: "REQ-002",
      title: "Cart Integration",
      priority: "should_have",
      fitGap: "config",
      status: "draft",
    });
  });

  return { programId, workstreamId, workstreamId2, requirementId, requirementId2 };
}

describe("getProgramQuery", () => {
  test("returns program by ID", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupProgramWithWorkstreams(t);

    const program = await t.query(internalAny.atlassian.jira.mapperQueries.getProgramQuery, {
      programId,
    });

    expect(program).toMatchObject({
      name: "Test Program",
      orgId: "org-1",
      sourcePlatform: "magento",
    });
  });

  test("returns null for nonexistent ID", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupProgramWithWorkstreams(t);

    // Delete the program to get a valid but nonexistent ID
    await t.run(async (ctx: any) => {
      await ctx.db.delete(programId);
    });

    const program = await t.query(internalAny.atlassian.jira.mapperQueries.getProgramQuery, {
      programId,
    });

    expect(program).toBeNull();
  });
});

describe("getWorkstreamQuery", () => {
  test("returns workstream by ID", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId } = await setupProgramWithWorkstreams(t);

    const workstream = await t.query(internalAny.atlassian.jira.mapperQueries.getWorkstreamQuery, {
      workstreamId,
    });

    expect(workstream).toMatchObject({
      name: "Frontend",
      shortCode: "FE",
    });
  });

  test("returns null for nonexistent ID", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId } = await setupProgramWithWorkstreams(t);

    await t.run(async (ctx: any) => {
      await ctx.db.delete(workstreamId);
    });

    const workstream = await t.query(internalAny.atlassian.jira.mapperQueries.getWorkstreamQuery, {
      workstreamId,
    });

    expect(workstream).toBeNull();
  });
});

describe("getRequirementQuery", () => {
  test("returns requirement by ID", async () => {
    const t = convexTest(schema, modules);
    const { requirementId } = await setupProgramWithWorkstreams(t);

    const requirement = await t.query(
      internalAny.atlassian.jira.mapperQueries.getRequirementQuery,
      { requirementId },
    );

    expect(requirement).toMatchObject({
      refId: "REQ-001",
      title: "Product Catalog Migration",
      priority: "must_have",
    });
  });

  test("returns null for nonexistent ID", async () => {
    const t = convexTest(schema, modules);
    const { requirementId } = await setupProgramWithWorkstreams(t);

    await t.run(async (ctx: any) => {
      await ctx.db.delete(requirementId);
    });

    const requirement = await t.query(
      internalAny.atlassian.jira.mapperQueries.getRequirementQuery,
      { requirementId },
    );

    expect(requirement).toBeNull();
  });
});

describe("listWorkstreamsInternal", () => {
  test("returns all workstreams for a program", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupProgramWithWorkstreams(t);

    const workstreams = await t.query(
      internalAny.atlassian.jira.mapperQueries.listWorkstreamsInternal,
      { programId },
    );

    expect(workstreams).toHaveLength(2);
    const names = workstreams.map((w: any) => w.name).sort();
    expect(names).toEqual(["Backend", "Frontend"]);
  });

  test("returns empty array for program with no workstreams", async () => {
    const t = convexTest(schema, modules);

    const emptyProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Empty Program",
        clientName: "Test Client",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "discovery",
        status: "active",
      });
    });

    const workstreams = await t.query(
      internalAny.atlassian.jira.mapperQueries.listWorkstreamsInternal,
      { programId: emptyProgramId },
    );

    expect(workstreams).toHaveLength(0);
  });
});

describe("listRequirementsByWorkstreamInternal", () => {
  test("returns all requirements for a workstream", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId } = await setupProgramWithWorkstreams(t);

    const requirements = await t.query(
      internalAny.atlassian.jira.mapperQueries.listRequirementsByWorkstreamInternal,
      { workstreamId },
    );

    expect(requirements).toHaveLength(2);
    const refIds = requirements.map((r: any) => r.refId).sort();
    expect(refIds).toEqual(["REQ-001", "REQ-002"]);
  });

  test("returns empty array for workstream with no requirements", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId2 } = await setupProgramWithWorkstreams(t);

    const requirements = await t.query(
      internalAny.atlassian.jira.mapperQueries.listRequirementsByWorkstreamInternal,
      { workstreamId: workstreamId2 },
    );

    expect(requirements).toHaveLength(0);
  });
});
