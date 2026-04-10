import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

describe("usageRecords.recordAiUsage", () => {
  test("inserts record with all fields and auto-generated recordedAt", async () => {
    const t = convexTest(schema, modules);

    const input = {
      orgId: "org-1",
      source: "document_analysis" as const,
      claudeModelId: "claude-opus-4-6",
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 200,
      cacheCreationTokens: 100,
      costUsd: 0.05,
      durationMs: 1234,
    };

    await t.mutation(internalAny.billing.usageRecords.recordAiUsage, input);

    const record = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("aiUsageRecords")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(record).not.toBeNull();
    expect(record.orgId).toBe("org-1");
    expect(record.source).toBe("document_analysis");
    expect(record.claudeModelId).toBe("claude-opus-4-6");
    expect(record.inputTokens).toBe(1000);
    expect(record.outputTokens).toBe(500);
    expect(record.cacheReadTokens).toBe(200);
    expect(record.cacheCreationTokens).toBe(100);
    expect(record.costUsd).toBe(0.05);
    expect(record.durationMs).toBe(1234);
    expect(record.recordedAt).toBeDefined();
    expect(typeof record.recordedAt).toBe("number");
  });

  test("recordedAt is set to current time", async () => {
    const t = convexTest(schema, modules);

    const before = Date.now();

    await t.mutation(internalAny.billing.usageRecords.recordAiUsage, {
      orgId: "org-1",
      source: "skill_execution" as const,
      claudeModelId: "claude-sonnet-4-5-20250514",
      inputTokens: 500,
      outputTokens: 250,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0.01,
    });

    const after = Date.now();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("aiUsageRecords")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(record).not.toBeNull();
    // recordedAt should be between before and after
    expect(record.recordedAt).toBeGreaterThanOrEqual(before);
    expect(record.recordedAt).toBeLessThanOrEqual(after);
  });
});
