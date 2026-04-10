import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CRONS_PATH = path.resolve(process.cwd(), "convex/crons.ts");
const SCHEDULED_ACTIONS_PATH = path.resolve(process.cwd(), "convex/scheduledActions.ts");

describe("video retention scheduling hooks", () => {
  it("registers daily retention cleanup cron", () => {
    const source = readFileSync(CRONS_PATH, "utf8");

    expect(source).toMatch(/"video-analysis-retention-cleanup"/);
    expect(source).toMatch(/crons\.interval\([\s\S]*\{\s*hours:\s*24\s*\}/);
    expect(source).toMatch(/internal\.scheduledActions\.runVideoAnalysisRetentionCleanup/);
  });

  it("scheduled action delegates to videoAnalysis retention cleanup action", () => {
    const source = readFileSync(SCHEDULED_ACTIONS_PATH, "utf8");

    expect(source).toMatch(/export const runVideoAnalysisRetentionCleanup = internalAction\(\{/);
    expect(source).toMatch(
      /ctx\.runAction\(\s*(internal|i)\.videoAnalysisActions\.runRetentionCleanup/,
    );
  });
});
