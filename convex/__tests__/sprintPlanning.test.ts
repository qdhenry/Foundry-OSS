import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

describe("sprintPlanning.storeRecommendation", () => {
  test("stores a sprint planning recommendation", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, sprintId } = await setupTestEnv(t);

    const recId = await t.mutation(internalAny.sprintPlanning.storeRecommendation, {
      orgId,
      sprintId,
      programId,
      recommendation: {
        suggestedTasks: ["Task 1", "Task 2"],
        capacityUtilization: 0.8,
        riskFactors: ["Tight timeline"],
      },
      totalTokensUsed: 1500,
    });

    expect(recId).toBeTruthy();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(recId);
    });

    expect(record.status).toBe("pending");
    expect(record.recommendation.suggestedTasks).toHaveLength(2);
    expect(record.recommendation.capacityUtilization).toBe(0.8);
    expect(record.totalTokensUsed).toBe(1500);
    expect(record.createdAt).toBeTypeOf("number");
  });
});

describe("sprintPlanning.getRecommendation", () => {
  test("returns the most recent recommendation for a sprint", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, sprintId, asUser } = await setupTestEnv(t);

    await t.mutation(internalAny.sprintPlanning.storeRecommendation, {
      orgId,
      sprintId,
      programId,
      recommendation: { version: 1 },
      totalTokensUsed: 1000,
    });

    await t.mutation(internalAny.sprintPlanning.storeRecommendation, {
      orgId,
      sprintId,
      programId,
      recommendation: { version: 2 },
      totalTokensUsed: 1200,
    });

    const result = await asUser.query(apiAny.sprintPlanning.getRecommendation, {
      sprintId,
    });

    expect(result).not.toBeNull();
    expect(result.recommendation.version).toBe(2);
  });

  test("returns null when no recommendations exist", async () => {
    const t = convexTest(schema, modules);
    const { sprintId, asUser } = await setupTestEnv(t);

    const result = await asUser.query(apiAny.sprintPlanning.getRecommendation, {
      sprintId,
    });

    expect(result).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { sprintId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.sprintPlanning.getRecommendation, {
        sprintId,
      }),
    ).rejects.toThrow();
  });
});
