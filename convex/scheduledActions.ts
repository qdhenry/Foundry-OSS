"use node";

import * as generatedApi from "./_generated/api";
import { internalAction } from "./_generated/server";

const internalApi: any = (generatedApi as any).internal;

/**
 * Scheduled entry point for nightly health scoring.
 * Iterates all active programs and runs health scoring for each.
 */
export const runHealthScoring = internalAction({
  args: {},
  handler: async (ctx) => {
    const programs = await ctx.runQuery(internalApi.scheduled.getAllActivePrograms);

    for (const program of programs) {
      try {
        await ctx.runAction(internalApi.healthScoringActions.computeHealthScores, {
          programId: program._id,
          orgId: program.orgId,
        });
      } catch (error) {
        console.error(`Health scoring failed for program ${program._id}:`, error);
      }
    }
  },
});

/**
 * Scheduled entry point for daily dependency detection.
 * Iterates all active programs and runs dependency detection for each.
 */
export const runDependencyDetection = internalAction({
  args: {},
  handler: async (ctx) => {
    const programs = await ctx.runQuery(internalApi.scheduled.getAllActivePrograms);

    for (const program of programs) {
      try {
        await ctx.runAction(internalApi.dependencyDetectionActions.detectDependencies, {
          programId: program._id,
          orgId: program.orgId,
        });
      } catch (error) {
        console.error(`Dependency detection failed for program ${program._id}:`, error);
      }
    }
  },
});

/**
 * Scheduled entry point for daily video retention cleanup.
 * Marks expired video analyses and related raw assets as retention-expired.
 */
export const runVideoAnalysisRetentionCleanup = internalAction({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runAction(internalApi.videoAnalysisActions.runRetentionCleanup);

    console.log(
      `[video-retention-cleanup] scanned=${result.scanned}, marked=${result.marked}, skipped=${result.skipped}`,
    );
  },
});
