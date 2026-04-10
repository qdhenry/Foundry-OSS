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
  seedInteraction,
  seedOtherOrg,
  seedTokenSet,
} from "./helpers/designFactory";

const apiAny: any = (generatedApi as any).api;

// ── create ────────────────────────────────────────────────────────────

describe("designAssets.create", () => {
  test("creates asset and returns an ID", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await asUser.mutation(apiAny.designAssets.create, {
      orgId: ORG_ID,
      programId,
      name: "Homepage Screenshot",
      type: "styleGuide",
    });

    expect(assetId).toBeDefined();

    const asset = await t.run(async (ctx: any) => ctx.db.get(assetId));
    expect(asset).not.toBeNull();
    expect(asset.name).toBe("Homepage Screenshot");
    expect(asset.orgId).toBe(ORG_ID);
    expect(asset.programId).toEqual(programId);
  });

  test("screenshot type sets status to 'uploaded'", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await asUser.mutation(apiAny.designAssets.create, {
      orgId: ORG_ID,
      programId,
      name: "Hero Screenshot",
      type: "screenshot",
    });

    const asset = await t.run(async (ctx: any) => ctx.db.get(assetId));
    expect(asset.status).toBe("uploaded");
  });

  test("tokens type sets status to 'analyzed'", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await asUser.mutation(apiAny.designAssets.create, {
      orgId: ORG_ID,
      programId,
      name: "design-tokens.json",
      type: "tokens",
    });

    const asset = await t.run(async (ctx: any) => ctx.db.get(assetId));
    expect(asset.status).toBe("analyzed");
  });
});

// ── listByProgram ─────────────────────────────────────────────────────

describe("designAssets.listByProgram", () => {
  test("returns all assets for a program with fileUrl field", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Asset A",
      type: "screenshot",
    });
    await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Asset B",
      type: "tokens",
    });

    const assets = await asUser.query(apiAny.designAssets.listByProgram, {
      programId,
    });

    expect(assets).toHaveLength(2);
    // fileUrl is present on each asset (null when no fileId)
    for (const asset of assets) {
      expect("fileUrl" in asset).toBe(true);
    }
  });

  test("cross-org access is denied", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    await seedOtherOrg(t);
    const asOther = t.withIdentity({ subject: OTHER_CLERK_USER_ID });

    await expect(asOther.query(apiAny.designAssets.listByProgram, { programId })).rejects.toThrow(
      "Access denied",
    );
  });
});

// ── get ───────────────────────────────────────────────────────────────

describe("designAssets.get", () => {
  test("returns single asset with fileUrl field", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Single Asset",
      type: "styleGuide",
    });

    const asset = await asUser.query(apiAny.designAssets.get, { assetId });

    expect(asset).not.toBeNull();
    expect(asset.name).toBe("Single Asset");
    expect("fileUrl" in asset).toBe(true);
  });
});

// ── update ────────────────────────────────────────────────────────────

describe("designAssets.update", () => {
  test("patches name and tags, verify via get", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Original Name",
      type: "styleGuide",
    });

    await asUser.mutation(apiAny.designAssets.update, {
      assetId,
      name: "Updated Name",
      tags: ["brand", "v2"],
    });

    const asset = await asUser.query(apiAny.designAssets.get, { assetId });
    expect(asset.name).toBe("Updated Name");
    expect(asset.tags).toEqual(["brand", "v2"]);
  });
});

// ── remove ────────────────────────────────────────────────────────────

describe("designAssets.remove", () => {
  test("deletes asset and it is gone", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "To Delete",
      type: "styleGuide",
    });

    await asUser.mutation(apiAny.designAssets.remove, { assetId });

    const asset = await t.run(async (ctx: any) => ctx.db.get(assetId));
    expect(asset).toBeNull();
  });

  test("cascade: deletes associated designAnalyses and designInteractions", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Asset With Children",
      type: "screenshot",
    });

    const analysisId = await seedAnalysis(t, {
      orgId: ORG_ID,
      programId,
      designAssetId: assetId,
    });

    const interactionId = await seedInteraction(t, {
      orgId: ORG_ID,
      programId,
      designAssetId: assetId,
      componentName: "Button",
      trigger: "hover",
      animationType: "fade",
    });

    await asUser.mutation(apiAny.designAssets.remove, { assetId });

    const analysis = await t.run(async (ctx: any) => ctx.db.get(analysisId));
    expect(analysis).toBeNull();

    const interaction = await t.run(async (ctx: any) => ctx.db.get(interactionId));
    expect(interaction).toBeNull();
  });

  test("cascade: deleting tokens asset removes associated designTokenSets", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId: ORG_ID,
      programId,
      name: "Token File",
      type: "tokens",
    });

    const tokenSetId = await seedTokenSet(t, {
      orgId: ORG_ID,
      programId,
      name: "Token Set",
      sourceAssetId: assetId,
    });

    await asUser.mutation(apiAny.designAssets.remove, { assetId });

    const tokenSet = await t.run(async (ctx: any) => ctx.db.get(tokenSetId));
    expect(tokenSet).toBeNull();
  });
});
