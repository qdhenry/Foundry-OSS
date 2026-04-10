import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";
import {
  CLERK_USER_ID,
  ORG_ID,
  OTHER_CLERK_USER_ID,
  seedDesignOrg,
  seedInteraction,
  seedOtherOrg,
} from "./helpers/designFactory";

const apiAny: any = (generatedApi as any).api;

// ── create ────────────────────────────────────────────────────────────

describe("designInteractions.create", () => {
  test("creates interaction with componentName, trigger, and animationType", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const interactionId = await asUser.mutation(apiAny.designInteractions.create, {
      orgId: ORG_ID,
      programId,
      componentName: "PrimaryButton",
      trigger: "hover",
      animationType: "scale",
      description: "Scale up 5% on hover",
    });

    expect(interactionId).toBeDefined();

    const interaction = await t.run(async (ctx: any) => ctx.db.get(interactionId));
    expect(interaction).not.toBeNull();
    expect(interaction.componentName).toBe("PrimaryButton");
    expect(interaction.trigger).toBe("hover");
    expect(interaction.animationType).toBe("scale");
    expect(interaction.orgId).toBe(ORG_ID);
  });
});

// ── listByProgram ─────────────────────────────────────────────────────

describe("designInteractions.listByProgram", () => {
  test("returns all interactions for a program", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    await seedInteraction(t, {
      orgId: ORG_ID,
      programId,
      componentName: "Button",
      trigger: "hover",
      animationType: "fade",
    });
    await seedInteraction(t, {
      orgId: ORG_ID,
      programId,
      componentName: "Modal",
      trigger: "click",
      animationType: "slide",
    });

    const interactions = await asUser.query(apiAny.designInteractions.listByProgram, { programId });

    expect(interactions).toHaveLength(2);
    const names = interactions.map((i: any) => i.componentName);
    expect(names).toContain("Button");
    expect(names).toContain("Modal");
  });

  test("cross-org access is denied", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    await seedOtherOrg(t);
    const asOther = t.withIdentity({ subject: OTHER_CLERK_USER_ID });

    await expect(
      asOther.query(apiAny.designInteractions.listByProgram, { programId }),
    ).rejects.toThrow("Access denied");
  });
});

// ── update ────────────────────────────────────────────────────────────

describe("designInteractions.update", () => {
  test("patches description", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const interactionId = await seedInteraction(t, {
      orgId: ORG_ID,
      programId,
      componentName: "NavLink",
      trigger: "hover",
      animationType: "underline",
    });

    await asUser.mutation(apiAny.designInteractions.update, {
      interactionId,
      description: "Underline slides in from left on hover",
    });

    const interaction = await t.run(async (ctx: any) => ctx.db.get(interactionId));
    expect(interaction.description).toBe("Underline slides in from left on hover");
  });
});

// ── remove ────────────────────────────────────────────────────────────

describe("designInteractions.remove", () => {
  test("deletes interaction", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedDesignOrg(t);
    const asUser = t.withIdentity({ subject: CLERK_USER_ID });

    const interactionId = await seedInteraction(t, {
      orgId: ORG_ID,
      programId,
      componentName: "ToDelete",
      trigger: "click",
      animationType: "fade",
    });

    await asUser.mutation(apiAny.designInteractions.remove, { interactionId });

    const interaction = await t.run(async (ctx: any) => ctx.db.get(interactionId));
    expect(interaction).toBeNull();
  });
});
