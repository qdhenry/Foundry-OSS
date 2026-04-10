import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";
import { seedOrg, seedProgram } from "../helpers/baseFactory";

describe("scheduled.getAllActivePrograms", () => {
  test("returns active programs only", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const { programId: activeProgram } = await seedProgram(t, {
      name: "Active Program",
      status: "active",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Completed Program",
        clientName: "Test Client 2",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "complete",
        status: "archived",
      });
    });

    const activePrograms = await t.query(internalAny.scheduled.getAllActivePrograms, {});
    expect(activePrograms).toHaveLength(1);
    expect(activePrograms[0]._id).toBe(activeProgram);
    expect(activePrograms[0].orgId).toBe("org-1");
  });

  test("returns empty array when no active programs exist", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Completed Program",
        clientName: "Test Client",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "complete",
        status: "archived",
      });
    });

    const result = await t.query(internalAny.scheduled.getAllActivePrograms, {});
    expect(result).toEqual([]);
  });

  test("returns multiple active programs", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Program A",
        clientName: "Client A",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "build",
        status: "active",
      });
      await ctx.db.insert("programs", {
        orgId: "org-2",
        name: "Program B",
        clientName: "Client B",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "discovery",
        status: "active",
      });
    });

    const result = await t.query(internalAny.scheduled.getAllActivePrograms, {});
    expect(result).toHaveLength(2);

    const orgIds = result.map((p: any) => p.orgId).sort();
    expect(orgIds).toEqual(["org-1", "org-2"]);
  });

  test("returns only _id and orgId fields", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    await seedProgram(t);

    const result = await t.query(internalAny.scheduled.getAllActivePrograms, {});
    expect(result).toHaveLength(1);

    const program = result[0];
    expect(program._id).toBeDefined();
    expect(program.orgId).toBeDefined();
    expect(program.name).toBeUndefined();
    expect(program.clientName).toBeUndefined();
    expect(program.sourcePlatform).toBeUndefined();
  });
});
