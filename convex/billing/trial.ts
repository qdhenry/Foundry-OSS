import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { planSlugValidator } from "./validators";

// ---------------------------------------------------------------------------
// Public mutation
// ---------------------------------------------------------------------------

/**
 * Initializes "The Smelt Experience" trial for a new org.
 * Idempotent — if a trialState record already exists, returns it without modification.
 *
 * Default limits: 10 sandbox sessions, 1 program.
 */
export const initializeTrial = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Check if trial already exists (idempotent)
    const existing = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (existing) {
      return existing;
    }

    const trialId = await ctx.db.insert("trialState", {
      orgId: args.orgId,
      sessionsUsed: 0,
      sessionsLimit: 10,
      programsUsed: 0,
      programsLimit: 1,
      startedAt: Date.now(),
    });

    return await ctx.db.get(trialId);
  },
});

// ---------------------------------------------------------------------------
// Public query
// ---------------------------------------------------------------------------

/** Returns the trial state for an org, or null if no trial has been initialized. */
export const getTrialState = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});

/**
 * Increments sessionsUsed counter.
 * Called by the gate check when a trial org launches a sandbox session.
 */
export const incrementTrialSession = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!trial) {
      throw new ConvexError("No trial state found for org");
    }

    if (trial.sessionsUsed >= trial.sessionsLimit) {
      throw new ConvexError("Trial session limit reached");
    }

    await ctx.db.patch(trial._id, {
      sessionsUsed: trial.sessionsUsed + 1,
    });
  },
});

/**
 * Increments programsUsed counter.
 * Called when a trial org creates a new program.
 */
export const incrementTrialProgram = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!trial) {
      throw new ConvexError("No trial state found for org");
    }

    if (trial.programsUsed >= trial.programsLimit) {
      throw new ConvexError("Trial program limit reached");
    }

    await ctx.db.patch(trial._id, {
      programsUsed: trial.programsUsed + 1,
    });
  },
});

// ---------------------------------------------------------------------------
// Public mutation — auto-init on org mount
// ---------------------------------------------------------------------------

/**
 * Called from frontend on org mount. If no subscription and no trial exists,
 * creates a trial. Idempotent — safe to call on every mount.
 */
export const ensureTrialInitialized = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Already has subscription? No trial needed.
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (subscription) return null;

    // Already has trial?
    const existing = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (existing) return existing;

    // Create trial
    const trialId = await ctx.db.insert("trialState", {
      orgId: args.orgId,
      sessionsUsed: 0,
      sessionsLimit: 10,
      programsUsed: 0,
      programsLimit: 1,
      startedAt: Date.now(),
    });
    return await ctx.db.get(trialId);
  },
});

// ---------------------------------------------------------------------------
// Public query — user-friendly trial status
// ---------------------------------------------------------------------------

/**
 * Returns a user-friendly trial status object for the org.
 * Accounts for subscriptions, active trials, and exhausted trials.
 */
export const getTrialStatus = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    return {
      isOnTrial: !!trial && !trial.convertedAt && !subscription,
      sessionsRemaining: trial ? Math.max(0, trial.sessionsLimit - trial.sessionsUsed) : 0,
      programsRemaining: trial ? Math.max(0, trial.programsLimit - trial.programsUsed) : 0,
      isExhausted: trial ? trial.sessionsUsed >= trial.sessionsLimit : false,
      isConverted: !!subscription || !!trial?.convertedAt,
      sessionsUsed: trial?.sessionsUsed ?? 0,
      sessionsLimit: trial?.sessionsLimit ?? 10,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (called by gate checks and webhook processor)
// ---------------------------------------------------------------------------

/**
 * Records trial conversion when checkout.session.completed fires.
 * Sets convertedAt timestamp and the plan the org converted to.
 */
export const convertTrial = internalMutation({
  args: {
    orgId: v.string(),
    planSlug: planSlugValidator,
  },
  handler: async (ctx, args) => {
    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!trial) {
      // Graceful no-op — org may not have had a trial (e.g., direct sales conversion)
      return;
    }

    await ctx.db.patch(trial._id, {
      convertedAt: Date.now(),
      convertedToPlan: args.planSlug,
    });
  },
});
