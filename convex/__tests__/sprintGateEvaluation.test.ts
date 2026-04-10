import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

// ── storeEvaluation ─────────────────────────────────────────────────

describe("sprintGateEvaluation.storeEvaluation", () => {
  test("stores an evaluation record", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, sprintId } = await setupTestEnv(t);

    const evalId = await t.mutation(internalAny.sprintGateEvaluation.storeEvaluation, {
      orgId,
      sprintId,
      programId,
      evaluation: {
        overallReadiness: 0.75,
        gateStatuses: [
          { name: "Code Complete", status: "passed" },
          { name: "Testing", status: "at_risk" },
        ],
      },
      totalTokensUsed: 1200,
    });

    expect(evalId).toBeTruthy();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(evalId);
    });

    expect(record.status).toBe("completed");
    expect(record.evaluation.overallReadiness).toBe(0.75);
    expect(record.totalTokensUsed).toBe(1200);
    expect(record.createdAt).toBeTypeOf("number");
  });
});

// ── getLatestEvaluation ─────────────────────────────────────────────

describe("sprintGateEvaluation.getLatestEvaluation", () => {
  test("returns the most recent evaluation for a sprint", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, sprintId, asUser } = await setupTestEnv(t);

    await t.mutation(internalAny.sprintGateEvaluation.storeEvaluation, {
      orgId,
      sprintId,
      programId,
      evaluation: { overallReadiness: 0.5 },
      totalTokensUsed: 800,
    });

    await t.mutation(internalAny.sprintGateEvaluation.storeEvaluation, {
      orgId,
      sprintId,
      programId,
      evaluation: { overallReadiness: 0.85 },
      totalTokensUsed: 900,
    });

    const latest = await asUser.query(apiAny.sprintGateEvaluation.getLatestEvaluation, {
      sprintId,
    });

    expect(latest).not.toBeNull();
    expect(latest.evaluation.overallReadiness).toBe(0.85);
  });

  test("returns null when no evaluations exist", async () => {
    const t = convexTest(schema, modules);
    const { sprintId, asUser } = await setupTestEnv(t);

    const result = await asUser.query(apiAny.sprintGateEvaluation.getLatestEvaluation, {
      sprintId,
    });

    expect(result).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { sprintId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.sprintGateEvaluation.getLatestEvaluation, {
        sprintId,
      }),
    ).rejects.toThrow();
  });
});
