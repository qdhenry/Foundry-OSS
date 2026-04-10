import { cronJobs } from "convex/server";
import * as generatedApi from "./_generated/api";

const internalApi: any = (generatedApi as any).internal;

const crons = cronJobs();

// Health scoring — runs every 24 hours (nightly)
crons.interval(
  "compute-health-scores",
  { hours: 24 },
  internalApi.scheduledActions.runHealthScoring,
);

// Dependency detection — runs every 24 hours (daily)
crons.interval(
  "detect-dependencies",
  { hours: 24 },
  internalApi.scheduledActions.runDependencyDetection,
);

// Source control reconciliation — runs daily
// Compares platform state with GitHub, auto-corrects drift
crons.interval(
  "source-control-reconciliation",
  { hours: 24 },
  internalApi.sourceControl.sync.reconciliationActions.runDailyReconciliation,
);

// Video analysis retention cleanup — runs every 24 hours (daily)
crons.interval(
  "video-analysis-retention-cleanup",
  { hours: 24 },
  internalApi.scheduledActions.runVideoAnalysisRetentionCleanup,
);

// Hourly: aggregate AI usage records into billing periods
crons.interval(
  "aggregate-billing-usage",
  { hours: 1 },
  internalApi.billing.aggregation.runUsageAggregation,
);

// Daily at 6 AM UTC: report overage usage to Stripe
crons.daily(
  "report-billing-overages",
  { hourUTC: 6, minuteUTC: 0 },
  internalApi.billing.overageReporting.reportAllOverages,
);

// Cleanup expired AI operation checkpoints — daily
crons.interval(
  "cleanup-expired-checkpoints",
  { hours: 24 },
  internalApi.health.checkpoints.cleanupExpired,
);

export default crons;
