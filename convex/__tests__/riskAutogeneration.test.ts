import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

// ── storeRiskAssessment ─────────────────────────────────────────────

describe("riskAutogeneration.storeRiskAssessment", () => {
  test("stores an assessment record", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestEnv(t);

    const assessmentId = await t.mutation(internalAny.riskAutogeneration.storeRiskAssessment, {
      orgId,
      programId,
      assessment: { summary: "Low risk overall" },
      changeType: "requirement_added",
      totalTokensUsed: 1000,
    });

    expect(assessmentId).toBeTruthy();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(assessmentId);
    });

    expect(record.status).toBe("completed");
    expect(record.changeType).toBe("requirement_added");
    expect(record.assessment.summary).toBe("Low risk overall");
    expect(record.totalTokensUsed).toBe(1000);
    expect(record.createdAt).toBeTypeOf("number");
  });

  test("stores assessment without newRisks", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId } = await setupTestEnv(t);

    const assessmentId = await t.mutation(internalAny.riskAutogeneration.storeRiskAssessment, {
      orgId,
      programId,
      assessment: { summary: "No new risks found" },
      changeType: "sprint_completed",
      totalTokensUsed: 800,
    });

    expect(assessmentId).toBeTruthy();
  });
});

// ── getLatestAssessment ─────────────────────────────────────────────

describe("riskAutogeneration.getLatestAssessment", () => {
  test("returns the most recent assessment for a program", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, asUser } = await setupTestEnv(t);

    await t.mutation(internalAny.riskAutogeneration.storeRiskAssessment, {
      orgId,
      programId,
      assessment: { summary: "First" },
      changeType: "requirement_added",
      totalTokensUsed: 500,
    });

    await t.mutation(internalAny.riskAutogeneration.storeRiskAssessment, {
      orgId,
      programId,
      assessment: { summary: "Second" },
      changeType: "sprint_completed",
      totalTokensUsed: 600,
    });

    const latest = await asUser.query(apiAny.riskAutogeneration.getLatestAssessment, {
      programId,
    });

    expect(latest).not.toBeNull();
    expect(latest.assessment.summary).toBe("Second");
  });

  test("returns null when no assessments exist", async () => {
    const t = convexTest(schema, modules);
    const { programId, asUser } = await setupTestEnv(t);

    const result = await asUser.query(apiAny.riskAutogeneration.getLatestAssessment, {
      programId,
    });

    expect(result).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { programId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.riskAutogeneration.getLatestAssessment, {
        programId,
      }),
    ).rejects.toThrow();
  });
});
