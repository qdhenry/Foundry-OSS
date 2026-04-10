import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";
import {
  CLERK_USER_ID,
  ORG_ID,
  OTHER_CLERK_USER_ID,
  seedAnalysis,
  seedDesignAsset,
  seedDesignOrg,
  seedOtherOrg,
  seedTokenSet,
} from "./helpers/designFactory";

const apiAny: any = (generatedApi as any).api;

// ── create ────────────────────────────────────────────────────────────

describe("designTokenSets.create", () => {
  test("creates token set with version 1", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const tokenSetId = await asUser.mutation(apiAny.designTokenSets.create, {
      orgId: ORG_ID,
      programId,
      name: "Brand Tokens v1",
      sourceType: "manual",
    });

    expect(tokenSetId).toBeDefined();

    const tokenSet = await t.run(async (ctx: any) => ctx.db.get(tokenSetId));
    expect(tokenSet).not.toBeNull();
    expect(tokenSet.name).toBe("Brand Tokens v1");
    expect(tokenSet.version).toBe(1);
  });

  test("second create for same program gets version 2", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await asUser.mutation(apiAny.designTokenSets.create, {
      orgId: ORG_ID,
      programId,
      name: "Tokens v1",
      sourceType: "manual",
    });

    const secondId = await asUser.mutation(apiAny.designTokenSets.create, {
      orgId: ORG_ID,
      programId,
      name: "Tokens v2",
      sourceType: "manual",
    });

    const second = await t.run(async (ctx: any) => ctx.db.get(secondId));
    expect(second.version).toBe(2);
  });
});

// ── listByProgram ─────────────────────────────────────────────────────

describe("designTokenSets.listByProgram", () => {
  test("returns all token sets for a program", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await seedTokenSet(t, { orgId: ORG_ID, programId, name: "Set A" });
    await seedTokenSet(t, { orgId: ORG_ID, programId, name: "Set B" });

    const sets = await asUser.query(apiAny.designTokenSets.listByProgram, {
      programId,
    });

    expect(sets).toHaveLength(2);
  });

  test("cross-org access is denied", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    await seedOtherOrg(t);
    const asOther = t.withIdentity({ subject: OTHER_CLERK_USER_ID });

    await expect(
      asOther.query(apiAny.designTokenSets.listByProgram, { programId }),
    ).rejects.toThrow("Access denied");
  });
});

// ── get ───────────────────────────────────────────────────────────────

describe("designTokenSets.get", () => {
  test("returns single token set", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const tokenSetId = await seedTokenSet(t, {
      orgId: ORG_ID,
      programId,
      name: "Single Set",
    });

    const tokenSet = await asUser.query(apiAny.designTokenSets.get, {
      tokenSetId,
    });

    expect(tokenSet).not.toBeNull();
    expect(tokenSet.name).toBe("Single Set");
  });
});

// ── update ────────────────────────────────────────────────────────────

describe("designTokenSets.update", () => {
  test("patches colors and tailwindConfig fields", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const tokenSetId = await seedTokenSet(t, {
      orgId: ORG_ID,
      programId,
      name: "Patchable Set",
    });

    const newColors = JSON.stringify({ primary: "#3B82F6", secondary: "#10B981" });
    const newTailwind = "module.exports = { theme: { extend: { colors: {} } } }";

    await asUser.mutation(apiAny.designTokenSets.update, {
      tokenSetId,
      colors: newColors,
      tailwindConfig: newTailwind,
    });

    const tokenSet = await asUser.query(apiAny.designTokenSets.get, {
      tokenSetId,
    });
    expect(tokenSet.colors).toBe(newColors);
    expect(tokenSet.tailwindConfig).toBe(newTailwind);
  });
});

// ── remove ────────────────────────────────────────────────────────────

describe("designTokenSets.remove", () => {
  test("deletes token set", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const tokenSetId = await seedTokenSet(t, {
      orgId: ORG_ID,
      programId,
      name: "To Delete",
    });

    await asUser.mutation(apiAny.designTokenSets.remove, { tokenSetId });

    const tokenSet = await t.run(async (ctx: any) => ctx.db.get(tokenSetId));
    expect(tokenSet).toBeNull();
  });
});

// ── clearAllForProgram ────────────────────────────────────────────────

describe("designTokenSets.clearAllForProgram", () => {
  test("seeds 3 token sets, clears all, count is 0", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await seedTokenSet(t, { orgId: ORG_ID, programId, name: "Set 1" });
    await seedTokenSet(t, { orgId: ORG_ID, programId, name: "Set 2" });
    await seedTokenSet(t, { orgId: ORG_ID, programId, name: "Set 3" });

    await asUser.mutation(apiAny.designTokenSets.clearAllForProgram, {
      programId,
    });

    const remaining = await asUser.query(apiAny.designTokenSets.listByProgram, {
      programId,
    });
    expect(remaining).toHaveLength(0);
  });
});

// ── createFromAnalysis ────────────────────────────────────────────────

describe("designTokenSets.createFromAnalysis", () => {
  test("creates token set with correct colors extracted from analysis", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Homepage Screenshot",
      type: "screenshot",
      status: "analyzed",
    });

    const analysisId = await seedAnalysis(t, {
      orgId: ORG_ID,
      programId,
      designAssetId: assetId,
      colors: [
        { name: "brand-blue", hex: "#3B82F6", usage: "Primary brand color" },
        { name: "brand-dark", hex: "#0D1117", usage: "Background color" },
      ],
    });

    const tokenSetId = await asUser.mutation(apiAny.designTokenSets.createFromAnalysis, {
      programId,
      analysisId,
      name: "Extracted Brand Tokens",
    });

    expect(tokenSetId).toBeDefined();

    const tokenSet = await t.run(async (ctx: any) => ctx.db.get(tokenSetId));
    expect(tokenSet).not.toBeNull();
    expect(tokenSet.name).toBe("Extracted Brand Tokens");
    expect(tokenSet.sourceType).toBe("extracted");

    // Verify colors were extracted
    const colors = JSON.parse(tokenSet.colors);
    expect(colors["brand-blue"]).toBe("#3B82F6");
    expect(colors["brand-dark"]).toBe("#0D1117");
  });
});
