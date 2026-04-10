import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery } from "../_generated/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GateCheckResult {
  allowed: boolean;
  isOverage: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
  overageRate?: number;
}

type BillableResource = "program" | "sandbox_session" | "seat" | "document_analysis";

// ---------------------------------------------------------------------------
// Core gate check — works in queries and mutations
// ---------------------------------------------------------------------------

/**
 * Checks whether the org is allowed to create the given resource.
 *
 * Decision tree:
 * 1. Active/trialing subscription -> check plan limits
 * 2. Unconverted trial -> check trial limits
 * 3. No subscription + no trial -> allow (design partner grace period)
 */
export async function checkPlanLimits(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  resource: BillableResource,
): Promise<GateCheckResult> {
  // Check subscription first (takes precedence over trial)
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();

  if (subscription && (subscription.status === "active" || subscription.status === "trialing")) {
    const plan = await ctx.db
      .query("pricingPlans")
      .withIndex("by_slug", (q) => q.eq("slug", subscription.planSlug))
      .first();

    if (!plan) {
      // Plan record missing — allow gracefully
      return { allowed: true, isOverage: false };
    }

    return await checkSubscriptionLimits(ctx, orgId, resource, subscription, plan);
  }

  // Check trial
  const trial = await ctx.db
    .query("trialState")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();

  if (trial && !trial.convertedAt) {
    return checkTrialLimits(trial, resource);
  }

  // No subscription and no trial — design partner grace period
  return { allowed: true, isOverage: false };
}

// ---------------------------------------------------------------------------
// Subscription limit checks
// ---------------------------------------------------------------------------

async function checkSubscriptionLimits(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  resource: BillableResource,
  subscription: { currentPeriodStart: number; currentPeriodEnd: number },
  plan: {
    limits: {
      maxSeats: number;
      maxPrograms: number;
      maxSessionsPerMonth: number;
    };
    overageRateUsd: number;
  },
): Promise<GateCheckResult> {
  const { limits } = plan;

  switch (resource) {
    case "program": {
      // Hard limit — -1 means unlimited
      if (limits.maxPrograms === -1) {
        return { allowed: true, isOverage: false };
      }
      const programs = await ctx.db
        .query("programs")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      const count = programs.length;
      if (count >= limits.maxPrograms) {
        return {
          allowed: false,
          isOverage: false,
          reason: `Program limit reached (${count}/${limits.maxPrograms}). Upgrade your plan for more programs.`,
          currentCount: count,
          limit: limits.maxPrograms,
        };
      }
      return { allowed: true, isOverage: false, currentCount: count, limit: limits.maxPrograms };
    }

    case "seat": {
      // Hard limit — -1 means unlimited
      if (limits.maxSeats === -1) {
        return { allowed: true, isOverage: false };
      }
      // Count unique users in this org. The users table stores orgIds as an
      // array but has no by_org index. For v1, collect all users and filter
      // in JS. User counts are small (< 100 per deployment).
      // TODO: Add a by_org index or a seatCount counter for O(1) lookups.
      const allUsers = await ctx.db.query("users").collect();
      const orgUsers = allUsers.filter((u) => u.orgIds.includes(orgId));
      const count = orgUsers.length;
      if (count >= limits.maxSeats) {
        return {
          allowed: false,
          isOverage: false,
          reason: `Seat limit reached (${count}/${limits.maxSeats}). Upgrade your plan for more seats.`,
          currentCount: count,
          limit: limits.maxSeats,
        };
      }
      return { allowed: true, isOverage: false, currentCount: count, limit: limits.maxSeats };
    }

    case "sandbox_session": {
      // Soft limit — allow but flag overage
      const usage = await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q) =>
          q.eq("orgId", orgId).gte("periodStart", subscription.currentPeriodStart),
        )
        .first();

      const sessionCount = usage?.sandboxSessionCount ?? 0;
      if (sessionCount >= limits.maxSessionsPerMonth) {
        return {
          allowed: true,
          isOverage: true,
          reason: `Monthly session limit exceeded (${sessionCount}/${limits.maxSessionsPerMonth}). Overage rate: $${plan.overageRateUsd}/session.`,
          currentCount: sessionCount,
          limit: limits.maxSessionsPerMonth,
          overageRate: plan.overageRateUsd,
        };
      }
      return {
        allowed: true,
        isOverage: false,
        currentCount: sessionCount,
        limit: limits.maxSessionsPerMonth,
      };
    }

    case "document_analysis": {
      // Document analyses count against the session bucket
      const usage = await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q) =>
          q.eq("orgId", orgId).gte("periodStart", subscription.currentPeriodStart),
        )
        .first();

      const sessionCount = usage?.sandboxSessionCount ?? 0;
      const docCount = usage?.documentAnalysisCount ?? 0;
      const combinedCount = sessionCount + docCount;
      if (combinedCount >= limits.maxSessionsPerMonth) {
        return {
          allowed: true,
          isOverage: true,
          reason: `Monthly usage limit exceeded (${combinedCount}/${limits.maxSessionsPerMonth}). Overage rate: $${plan.overageRateUsd}/unit.`,
          currentCount: combinedCount,
          limit: limits.maxSessionsPerMonth,
          overageRate: plan.overageRateUsd,
        };
      }
      return {
        allowed: true,
        isOverage: false,
        currentCount: combinedCount,
        limit: limits.maxSessionsPerMonth,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Trial limit checks
// ---------------------------------------------------------------------------

function checkTrialLimits(
  trial: {
    sessionsUsed: number;
    sessionsLimit: number;
    programsUsed: number;
    programsLimit: number;
  },
  resource: BillableResource,
): GateCheckResult {
  switch (resource) {
    case "program": {
      // Hard limit
      if (trial.programsUsed >= trial.programsLimit) {
        return {
          allowed: false,
          isOverage: false,
          reason: `Trial program limit reached (${trial.programsUsed}/${trial.programsLimit}). Subscribe to create more programs.`,
          currentCount: trial.programsUsed,
          limit: trial.programsLimit,
        };
      }
      return {
        allowed: true,
        isOverage: false,
        currentCount: trial.programsUsed,
        limit: trial.programsLimit,
      };
    }

    case "sandbox_session": {
      // Hard limit (lifetime, not monthly)
      if (trial.sessionsUsed >= trial.sessionsLimit) {
        return {
          allowed: false,
          isOverage: false,
          reason: `Trial session limit reached (${trial.sessionsUsed}/${trial.sessionsLimit}). Subscribe to launch more sessions.`,
          currentCount: trial.sessionsUsed,
          limit: trial.sessionsLimit,
        };
      }
      return {
        allowed: true,
        isOverage: false,
        currentCount: trial.sessionsUsed,
        limit: trial.sessionsLimit,
      };
    }

    case "seat": {
      // Trial hard-limited to 1 seat
      return {
        allowed: false,
        isOverage: false,
        reason: "Trial accounts are limited to 1 seat. Subscribe to add team members.",
        currentCount: 1,
        limit: 1,
      };
    }

    case "document_analysis": {
      // Doc analyses count against session budget during trial
      if (trial.sessionsUsed >= trial.sessionsLimit) {
        return {
          allowed: false,
          isOverage: false,
          reason: `Trial usage limit reached (${trial.sessionsUsed}/${trial.sessionsLimit}). Subscribe for more analyses.`,
          currentCount: trial.sessionsUsed,
          limit: trial.sessionsLimit,
        };
      }
      return {
        allowed: true,
        isOverage: false,
        currentCount: trial.sessionsUsed,
        limit: trial.sessionsLimit,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Throwing wrapper — use in mutations that enforce hard limits
// ---------------------------------------------------------------------------

/**
 * Throws ConvexError with code PLAN_LIMIT_EXCEEDED if the resource is not allowed.
 * Returns the GateCheckResult for soft-limit inspection (e.g., isOverage).
 */
export async function assertWithinPlanLimits(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  resource: BillableResource,
): Promise<GateCheckResult> {
  const result = await checkPlanLimits(ctx, orgId, resource);
  if (!result.allowed) {
    throw new ConvexError({
      code: "PLAN_LIMIT_EXCEEDED",
      resource,
      current: result.currentCount,
      limit: result.limit,
      reason: result.reason,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal query wrappers — callable from actions via ctx.runQuery()
// ---------------------------------------------------------------------------

const resourceValidator = v.union(
  v.literal("program"),
  v.literal("sandbox_session"),
  v.literal("seat"),
  v.literal("document_analysis"),
);

/**
 * Internal query that wraps checkPlanLimits for use from actions.
 * Actions cannot call helper functions directly — they must go through
 * ctx.runQuery / ctx.runMutation.
 */
export const checkPlanLimitsQuery = internalQuery({
  args: {
    orgId: v.string(),
    resource: resourceValidator,
  },
  handler: async (ctx, args): Promise<GateCheckResult> => {
    return await checkPlanLimits(ctx, args.orgId, args.resource);
  },
});
