import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";
import {
  CLERK_USER_ID,
  OTHER_CLERK_USER_ID,
  seedAnalysis,
  seedDesignAsset,
  seedDesignOrg,
  seedOtherOrg,
} from "./helpers/designFactory";

const apiAny: any = (generatedApi as any).api;

// ── getByAsset ──────────────────────────────────────────────────────────

describe("designAnalyses.getByAsset", () => {
  test("returns the analysis for an asset", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "hero.png",
      type: "screenshot",
      status: "analyzed",
    });

    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: assetId,
      colors: [{ name: "primary", hex: "#3B82F6", usage: "Brand color" }],
      typography: [
        {
          role: "heading1",
          fontFamily: "Inter",
          fontSize: "32px",
          fontWeight: "700",
        },
      ],
      components: [{ name: "HeroButton", type: "button", description: "CTA button" }],
    });

    const analysis = await asUser.query(apiAny.designAnalyses.getByAsset, {
      designAssetId: assetId,
    });

    expect(analysis).not.toBeNull();
    expect(analysis.designAssetId).toEqual(assetId);
    expect(analysis.extractedColors).toHaveLength(1);
    expect(analysis.extractedColors[0].hex).toBe("#3B82F6");
    expect(analysis.extractedTypography).toHaveLength(1);
    expect(analysis.extractedTypography[0].fontFamily).toBe("Inter");
    expect(analysis.extractedComponents).toHaveLength(1);
    expect(analysis.extractedComponents[0].name).toBe("HeroButton");
  });

  test("returns the latest analysis when multiple exist for the same asset", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "hero.png",
      type: "screenshot",
      status: "analyzed",
    });

    // First analysis (older)
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: assetId,
      colors: [{ name: "old-primary", hex: "#FF0000", usage: "Old brand" }],
    });

    // Second analysis (newer — inserted last so it will be last in collect())
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: assetId,
      colors: [{ name: "new-primary", hex: "#3B82F6", usage: "New brand" }],
    });

    const analysis = await asUser.query(apiAny.designAnalyses.getByAsset, {
      designAssetId: assetId,
    });

    expect(analysis).not.toBeNull();
    // getByAsset returns analyses[analyses.length - 1], i.e. the last one inserted
    expect(analysis.extractedColors[0].name).toBe("new-primary");
    expect(analysis.extractedColors[0].hex).toBe("#3B82F6");
  });

  test("returns null for a non-existent asset", async () => {
    const t = convexTest(schema, modules);
    await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    // Insert a real asset so we get a valid-shaped ID, then delete it so it doesn't exist
    const { programId, orgId } = await seedDesignOrg(t);
    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "temp.png",
      type: "screenshot",
    });
    await t.run(async (ctx: any) => {
      await ctx.db.delete(assetId);
    });

    const analysis = await asUser.query(apiAny.designAnalyses.getByAsset, {
      designAssetId: assetId,
    });

    expect(analysis).toBeNull();
  });

  test("returns null when the asset has no analyses", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "no-analysis.png",
      type: "screenshot",
      status: "uploaded",
    });

    const analysis = await asUser.query(apiAny.designAnalyses.getByAsset, {
      designAssetId: assetId,
    });

    expect(analysis).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);
    await seedOtherOrg(t);
    const asOtherUser = t.withIdentity({ subject: OTHER_CLERK_USER_ID });

    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "private.png",
      type: "screenshot",
      status: "analyzed",
    });

    await expect(
      asOtherUser.query(apiAny.designAnalyses.getByAsset, {
        designAssetId: assetId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByProgram ───────────────────────────────────────────────────────

describe("designAnalyses.listByProgram", () => {
  test("returns all analyses for a program", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const assetA = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "screen-a.png",
      type: "screenshot",
    });
    const assetB = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "screen-b.png",
      type: "screenshot",
    });

    await seedAnalysis(t, { orgId, programId, designAssetId: assetA });
    await seedAnalysis(t, { orgId, programId, designAssetId: assetB });

    const analyses = await asUser.query(apiAny.designAnalyses.listByProgram, {
      programId,
    });

    expect(analyses).toHaveLength(2);
    const assetIds = analyses.map((a: any) => a.designAssetId);
    expect(assetIds).toContainEqual(assetA);
    expect(assetIds).toContainEqual(assetB);
  });

  test("returns empty array when program has no analyses", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const analyses = await asUser.query(apiAny.designAnalyses.listByProgram, {
      programId,
    });

    expect(analyses).toEqual([]);
  });

  test("does not include analyses from other programs", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId, userId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    // Create a second program in the same org
    const otherProgramId = await t.run(async (ctx: any) => {
      return ctx.db.insert("programs", {
        orgId,
        name: "Other Program",
        clientName: "Other Client",
        sourcePlatform: "magento",
        targetPlatform: "bigcommerce_b2b",
        phase: "discovery",
        status: "active",
      });
    });

    const assetInProgram = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "in-program.png",
      type: "screenshot",
    });
    const assetInOther = await seedDesignAsset(t, {
      orgId,
      programId: otherProgramId,
      name: "other-program.png",
      type: "screenshot",
    });

    await seedAnalysis(t, { orgId, programId, designAssetId: assetInProgram });
    await seedAnalysis(t, {
      orgId,
      programId: otherProgramId,
      designAssetId: assetInOther,
    });

    const analyses = await asUser.query(apiAny.designAnalyses.listByProgram, {
      programId,
    });

    expect(analyses).toHaveLength(1);
    expect(analyses[0].designAssetId).toEqual(assetInProgram);
  });

  test("returns empty array for non-existent program", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    // Delete the program so it no longer exists
    await t.run(async (ctx: any) => {
      await ctx.db.delete(programId);
    });

    const analyses = await asUser.query(apiAny.designAnalyses.listByProgram, {
      programId,
    });

    expect(analyses).toEqual([]);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    await seedOtherOrg(t);
    const asOtherUser = t.withIdentity({ subject: OTHER_CLERK_USER_ID });

    await expect(
      asOtherUser.query(apiAny.designAnalyses.listByProgram, { programId }),
    ).rejects.toThrow("Access denied");
  });
});
