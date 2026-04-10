import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { resolveDesignCascade } from "../model/designCascade";
import schema from "../schema";
import { modules } from "../test.helpers";
import {
  seedAnalysis,
  seedDesignAsset,
  seedDesignOrg,
  seedInteraction,
  seedTokenSet,
} from "./helpers/designFactory";

// ── resolveDesignCascade ────────────────────────────────────────────────

describe("resolveDesignCascade", () => {
  test("empty program — returns empty context with no token set", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    expect(result.assetIds).toHaveLength(0);
    expect(result.resolvedComponents).toHaveLength(0);
    expect(result.tokenSetId).toBeNull();
    expect(result.interactionSpecs).toHaveLength(0);
    expect(result.screenSpecs).toBeNull();
    expect(result.degraded).toBe(true);
  });

  test("program-level assets and tokens resolve correctly", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    // Seed a program-level asset (no workstream, no requirement)
    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "logo.png",
      type: "screenshot",
      status: "analyzed",
    });

    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: assetId,
      components: [
        { name: "Logo", type: "image", description: "Brand logo" },
        { name: "NavBar", type: "nav", description: "Top navigation" },
      ],
    });

    await seedTokenSet(t, {
      orgId,
      programId,
      name: "Base Tokens",
      colors: { primary: "#3B82F6", background: "#0D1117" },
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    expect(result.assetIds).toHaveLength(1);
    expect(result.assetIds).toContainEqual(assetId);
    expect(result.resolvedComponents).toHaveLength(2);
    expect(result.resolvedComponents.map((c: any) => c.name)).toContain("Logo");
    expect(result.resolvedComponents.map((c: any) => c.name)).toContain("NavBar");
    expect(result.tokenSetId).not.toBeNull();
    expect(result.resolvedTokens.colors).toEqual({
      primary: "#3B82F6",
      background: "#0D1117",
    });
    expect(result.degraded).toBe(false);
  });

  test("workstream-level asset is included when workstreamId is provided", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    // Seed a workstream
    const workstreamId = await t.run(async (ctx: any) => {
      return ctx.db.insert("workstreams", {
        orgId,
        programId,
        name: "Frontend",
        shortCode: "FE",
        status: "on_track",
        sortOrder: 1,
      });
    });

    // Seed a program-level asset
    const programAssetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "global.png",
      type: "screenshot",
      status: "analyzed",
    });
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: programAssetId,
      components: [{ name: "Footer", type: "section", description: "Page footer" }],
    });

    // Seed a workstream-level asset directly (factory doesn't support workstreamId)
    const workstreamAssetId = await t.run(async (ctx: any) => {
      return ctx.db.insert("designAssets", {
        orgId,
        programId,
        workstreamId,
        name: "nav.png",
        type: "screenshot",
        version: 1,
        status: "analyzed",
      });
    });
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: workstreamAssetId,
      components: [{ name: "NavBar", type: "nav", description: "Workstream nav" }],
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId, workstreamId });
    });

    expect(result.assetIds).toHaveLength(2);
    expect(result.assetIds).toContainEqual(programAssetId);
    expect(result.assetIds).toContainEqual(workstreamAssetId);
    const componentNames = result.resolvedComponents.map((c: any) => c.name);
    expect(componentNames).toContain("Footer");
    expect(componentNames).toContain("NavBar");
  });

  test("workstream query without workstreamId only returns program-level assets", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    const workstreamId = await t.run(async (ctx: any) => {
      return ctx.db.insert("workstreams", {
        orgId,
        programId,
        name: "Frontend",
        shortCode: "FE",
        status: "on_track",
        sortOrder: 1,
      });
    });

    // Seed only a workstream-scoped asset — no program-level assets
    await t.run(async (ctx: any) => {
      return ctx.db.insert("designAssets", {
        orgId,
        programId,
        workstreamId,
        name: "ws-only.png",
        type: "screenshot",
        version: 1,
        status: "analyzed",
      });
    });

    // Resolve WITHOUT passing workstreamId
    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    // The workstream-level asset should NOT be included since we didn't pass workstreamId
    expect(result.assetIds).toHaveLength(0);
    expect(result.resolvedComponents).toHaveLength(0);
  });

  test("component dedup — most specific level wins (last write wins)", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    // Seed a workstream
    const workstreamId = await t.run(async (ctx: any) => {
      return ctx.db.insert("workstreams", {
        orgId,
        programId,
        name: "Frontend",
        shortCode: "FE",
        status: "on_track",
        sortOrder: 1,
      });
    });

    // Program-level asset: defines "Button" as generic
    const programAssetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "global.png",
      type: "screenshot",
      status: "analyzed",
    });
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: programAssetId,
      components: [
        { name: "Button", type: "button", description: "Generic button (program-level)" },
        { name: "Header", type: "header", description: "Site header" },
      ],
    });

    // Workstream-level asset: overrides "Button" with a more specific description
    const workstreamAssetId = await t.run(async (ctx: any) => {
      return ctx.db.insert("designAssets", {
        orgId,
        programId,
        workstreamId,
        name: "ws.png",
        type: "screenshot",
        version: 1,
        status: "analyzed",
      });
    });
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: workstreamAssetId,
      components: [
        { name: "Button", type: "button", description: "CTA button (workstream-specific)" },
      ],
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId, workstreamId });
    });

    // Only one "Button" should exist
    const buttons = result.resolvedComponents.filter((c: any) => c.name === "Button");
    expect(buttons).toHaveLength(1);
    // The workstream-level (more specific) description should win
    expect(buttons[0].description).toBe("CTA button (workstream-specific)");
    // Header from program level should also be present
    const headers = result.resolvedComponents.filter((c: any) => c.name === "Header");
    expect(headers).toHaveLength(1);
  });

  test("token set resolution — latest version is used", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    // Seed an older version
    await t.run(async (ctx: any) => {
      return ctx.db.insert("designTokenSets", {
        orgId,
        programId,
        name: "Tokens v1",
        version: 1,
        colors: JSON.stringify({ primary: "#FF0000" }),
        sourceType: "manual",
      });
    });

    // Seed a newer version
    const newerTokenSetId = await t.run(async (ctx: any) => {
      return ctx.db.insert("designTokenSets", {
        orgId,
        programId,
        name: "Tokens v2",
        version: 2,
        colors: JSON.stringify({ primary: "#3B82F6" }),
        sourceType: "manual",
      });
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    expect(result.tokenSetId).toEqual(newerTokenSetId);
    expect((result.resolvedTokens.colors as any).primary).toBe("#3B82F6");
  });

  test("interaction specs are included in the resolved output", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "anim.png",
      type: "interactionSpec",
      status: "analyzed",
    });

    await seedInteraction(t, {
      orgId,
      programId,
      designAssetId: assetId,
      componentName: "DropdownMenu",
      trigger: "hover",
      animationType: "fade-in",
    });

    await seedInteraction(t, {
      orgId,
      programId,
      designAssetId: assetId,
      componentName: "Modal",
      trigger: "click",
      animationType: "slide-up",
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    expect(result.interactionSpecs).toHaveLength(2);
    const names = result.interactionSpecs.map((i: any) => i.componentName);
    expect(names).toContain("DropdownMenu");
    expect(names).toContain("Modal");

    const dropdown = result.interactionSpecs.find((i: any) => i.componentName === "DropdownMenu");
    expect(dropdown?.trigger).toBe("hover");
    expect(dropdown?.animationType).toBe("fade-in");
  });

  test("degraded flag is false when token set exists even with no components", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    // Seed only a token set, no assets/analyses
    await seedTokenSet(t, {
      orgId,
      programId,
      name: "Minimal Tokens",
      colors: { bg: "#fff" },
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    expect(result.tokenSetId).not.toBeNull();
    expect(result.degraded).toBe(false);
  });

  test("degraded flag is false when components exist even with no token set", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    const assetId = await seedDesignAsset(t, {
      orgId,
      programId,
      name: "comp.png",
      type: "screenshot",
      status: "analyzed",
    });
    await seedAnalysis(t, {
      orgId,
      programId,
      designAssetId: assetId,
      components: [{ name: "Card", type: "card", description: "Content card" }],
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, { orgId, programId });
    });

    expect(result.tokenSetId).toBeNull();
    expect(result.resolvedComponents).toHaveLength(1);
    expect(result.degraded).toBe(false);
  });

  test("screen specs are populated from requirement-level analyses", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await seedDesignOrg(t);

    const workstreamId = await t.run(async (ctx: any) => {
      return ctx.db.insert("workstreams", {
        orgId,
        programId,
        name: "Frontend",
        shortCode: "FE",
        status: "on_track",
        sortOrder: 1,
      });
    });

    // Create a requirement
    const requirementId = await t.run(async (ctx: any) => {
      return ctx.db.insert("requirements", {
        orgId,
        programId,
        workstreamId,
        refId: "REQ-001",
        title: "Checkout Flow",
        description: "Checkout UI",
        priority: "must_have",
        fitGap: "custom_dev",
        status: "draft",
      });
    });

    // Seed a requirement-level asset
    const reqAssetId = await t.run(async (ctx: any) => {
      return ctx.db.insert("designAssets", {
        orgId,
        programId,
        requirementId,
        name: "checkout.png",
        type: "screenshot",
        version: 1,
        status: "analyzed",
      });
    });

    // Seed analysis with a specific markdownSummary for the screen spec
    await t.run(async (ctx: any) => {
      return ctx.db.insert("designAnalyses", {
        orgId,
        programId,
        designAssetId: reqAssetId,
        structuredSpec: "{}",
        markdownSummary: "# Checkout Screen\n\nFull-page checkout with cart summary.",
        extractedComponents: [],
        model: "claude-opus-4-1-20250805",
        analyzedAt: Date.now(),
      });
    });

    const result = await t.run(async (ctx) => {
      return resolveDesignCascade(ctx, {
        orgId,
        programId,
        requirementId,
      });
    });

    expect(result.screenSpecs).toBe("# Checkout Screen\n\nFull-page checkout with cart summary.");
    expect(result.assetIds).toContainEqual(reqAssetId);
  });
});
