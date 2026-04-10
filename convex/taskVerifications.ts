import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";

const internalAny: any = (generatedApi as any).internal;
const apiAny: any = (generatedApi as any).api;

async function getAuthorizedTask(ctx: Parameters<typeof assertOrgAccess>[0], taskId: any) {
  const db = ctx.db as any;
  const task = (await db.get(taskId)) as any;
  if (!task) throw new ConvexError("Task not found");
  await assertOrgAccess(ctx, task.orgId);
  return task;
}

async function getAuthorizedVerification(
  ctx: Parameters<typeof assertOrgAccess>[0],
  verificationId: any,
) {
  const db = ctx.db as any;
  const verification = (await db.get(verificationId)) as any;
  if (!verification) return null;
  await assertOrgAccess(ctx, verification.orgId);
  return verification;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

// Query: list all verifications for a task
export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await getAuthorizedTask(ctx, args.taskId);
    const db = ctx.db as any;
    const verifications = await db
      .query("taskVerifications")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();
    // Sort newest first
    verifications.sort((a: any, b: any) => b._creationTime - a._creationTime);
    return verifications;
  },
});

// Query: get latest verification for a task
export const getLatestByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await getAuthorizedTask(ctx, args.taskId);
    const db = ctx.db as any;
    const verifications = await db
      .query("taskVerifications")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();
    if (verifications.length === 0) return null;
    verifications.sort((a: any, b: any) => b._creationTime - a._creationTime);
    return verifications[0];
  },
});

// Query: get a single verification
export const get = query({
  args: { verificationId: v.id("taskVerifications") },
  handler: async (ctx, args) => {
    return await getAuthorizedVerification(ctx, args.verificationId);
  },
});

// Query: screenshots for a verification with storage URLs
export const getScreenshots = query({
  args: { verificationId: v.id("taskVerifications") },
  handler: async (ctx, args) => {
    const verification = await getAuthorizedVerification(ctx, args.verificationId);
    if (!verification) return [];
    const db = ctx.db as any;
    const screenshots = await db
      .query("verificationScreenshots")
      .withIndex("by_verification", (q: any) => q.eq("verificationId", args.verificationId))
      .collect();
    return await Promise.all(
      screenshots.map(async (s: any) => ({
        ...s,
        url: await ctx.storage.getUrl(s.storageId),
      })),
    );
  },
});

// Query: checks for a verification
export const getChecks = query({
  args: { verificationId: v.id("taskVerifications") },
  handler: async (ctx, args) => {
    const verification = await getAuthorizedVerification(ctx, args.verificationId);
    if (!verification) return [];
    const db = ctx.db as any;
    return await db
      .query("verificationChecks")
      .withIndex("by_verification", (q: any) => q.eq("verificationId", args.verificationId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------

// Internal query: get verification without auth (for internal actions)
export const getInternal = internalQuery({
  args: { verificationId: v.id("taskVerifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.verificationId);
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

// Internal mutation: create a verification record
export const create = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    taskId: v.id("tasks"),
    sandboxSessionId: v.optional(v.id("sandboxSessions")),
    triggeredBy: v.id("users"),
    trigger: v.union(v.literal("automatic"), v.literal("manual")),
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    commitSha: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("taskVerifications", {
      ...args,
    });
  },
});

// Internal mutation: update status and optional result fields
export const updateStatus = internalMutation({
  args: {
    verificationId: v.id("taskVerifications"),
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    navigationPlan: v.optional(v.any()),
    checksTotal: v.optional(v.number()),
    checksPassed: v.optional(v.number()),
    checksFailed: v.optional(v.number()),
    screenshotCount: v.optional(v.number()),
    aiSummary: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { verificationId, ...fields } = args;
    const update: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) update[key] = val;
    }
    await ctx.db.patch(verificationId, update);
  },
});

// Internal mutation: save a screenshot record
export const saveScreenshot = internalMutation({
  args: {
    orgId: v.string(),
    verificationId: v.id("taskVerifications"),
    storageId: v.id("_storage"),
    route: v.string(),
    label: v.string(),
    viewport: v.object({ width: v.number(), height: v.number() }),
    capturedAt: v.number(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("verificationScreenshots", args);
  },
});

// Internal mutation: save a check record
export const saveCheck = internalMutation({
  args: {
    orgId: v.string(),
    verificationId: v.id("taskVerifications"),
    type: v.union(
      v.literal("visual"),
      v.literal("functional"),
      v.literal("accessibility"),
      v.literal("console_error"),
      v.literal("network_error"),
    ),
    description: v.string(),
    status: v.union(
      v.literal("passed"),
      v.literal("failed"),
      v.literal("warning"),
      v.literal("skipped"),
    ),
    route: v.optional(v.string()),
    selector: v.optional(v.string()),
    expected: v.optional(v.string()),
    actual: v.optional(v.string()),
    screenshotId: v.optional(v.id("verificationScreenshots")),
    aiExplanation: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("verificationChecks", args);
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

// Mutation: generate upload URL for screenshot blobs
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// Internal actions
// ---------------------------------------------------------------------------

// Internal action: apply worker status updates before final results arrive
export const processStatusUpdate = internalAction({
  args: {
    verificationId: v.id("taskVerifications"),
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    startedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.runQuery(internalAny.taskVerifications.getInternal, {
      verificationId: args.verificationId,
    });
    if (!verification) return;

    const patch: Record<string, any> = {
      verificationId: args.verificationId,
      status: args.status,
    };

    if (args.startedAt !== undefined) {
      patch.startedAt = args.startedAt;
    }
    if (args.error !== undefined) {
      patch.error = args.error;
    }
    if (args.durationMs !== undefined) {
      patch.durationMs = args.durationMs;
    }
    if (
      (args.status === "failed" || args.status === "cancelled") &&
      verification.completedAt === undefined
    ) {
      const completedAt = Date.now();
      patch.completedAt = completedAt;
      if (patch.durationMs === undefined && verification.startedAt !== undefined) {
        patch.durationMs = Math.max(0, completedAt - verification.startedAt);
      }
    }

    await ctx.runMutation(internalAny.taskVerifications.updateStatus, patch);
  },
});

// Internal action: process results from verification worker
export const processResults = internalAction({
  args: {
    verificationId: v.id("taskVerifications"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    checks: v.array(
      v.object({
        type: v.union(
          v.literal("visual"),
          v.literal("functional"),
          v.literal("accessibility"),
          v.literal("console_error"),
          v.literal("network_error"),
        ),
        description: v.string(),
        status: v.union(
          v.literal("passed"),
          v.literal("failed"),
          v.literal("warning"),
          v.literal("skipped"),
        ),
        route: v.optional(v.string()),
        selector: v.optional(v.string()),
        expected: v.optional(v.string()),
        actual: v.optional(v.string()),
        aiExplanation: v.optional(v.string()),
      }),
    ),
    screenshotStorageIds: v.array(
      v.object({
        storageId: v.id("_storage"),
        route: v.string(),
        label: v.string(),
        viewport: v.object({ width: v.number(), height: v.number() }),
        capturedAt: v.number(),
        order: v.number(),
      }),
    ),
    aiSummary: v.string(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the verification record to access orgId
    const verification = await ctx.runQuery(internalAny.taskVerifications.getInternal, {
      verificationId: args.verificationId,
    });
    if (!verification) return;

    // Save screenshots
    for (const ss of args.screenshotStorageIds) {
      await ctx.runMutation(internalAny.taskVerifications.saveScreenshot, {
        orgId: verification.orgId,
        verificationId: args.verificationId,
        ...ss,
      });
    }

    // Save checks
    for (let i = 0; i < args.checks.length; i++) {
      await ctx.runMutation(internalAny.taskVerifications.saveCheck, {
        orgId: verification.orgId,
        verificationId: args.verificationId,
        ...args.checks[i],
        order: i,
      });
    }

    // Compute results
    const passed = args.checks.filter((c) => c.status === "passed").length;
    const failed = args.checks.filter((c) => c.status === "failed").length;

    // Update verification record
    await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
      verificationId: args.verificationId,
      status: args.status,
      checksTotal: args.checks.length,
      checksPassed: passed,
      checksFailed: failed,
      screenshotCount: args.screenshotStorageIds.length,
      aiSummary: args.aiSummary,
      completedAt: Date.now(),
      durationMs: args.durationMs,
    });

    // Send notification
    const allPassed = failed === 0;
    await ctx.runMutation(internalAny.notifications.create, {
      orgId: verification.orgId,
      userId: verification.triggeredBy,
      programId: verification.programId,
      type: allPassed ? "verification_completed" : "verification_failed",
      title: allPassed
        ? "Verification passed"
        : `Verification: ${failed} issue${failed !== 1 ? "s" : ""} found`,
      body: `${passed}/${args.checks.length} checks passed. ${args.screenshotStorageIds.length} screenshots captured.`,
      entityType: "taskVerification",
      entityId: String(args.verificationId),
      link: `/${verification.programId}/tasks/${verification.taskId}`,
    });
  },
});

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

// Public action: re-trigger verification from UI
export const retriggerVerification = action({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Look up the user via public query
    const user = await ctx.runQuery(apiAny.users.getByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new ConvexError("User not found");

    await ctx.runQuery(apiAny.tasks.get, { taskId: args.taskId });
    const session = await ctx.runQuery(apiAny.sandbox.sessions.getByTask, {
      taskId: args.taskId,
    });
    if (!session?._id) {
      return {
        success: false,
        error: "No sandbox session available — run a sandbox execution first before re-verifying.",
      };
    }

    await ctx.scheduler.runAfter(0, internalAny.taskVerificationActions.triggerVerification, {
      taskId: args.taskId,
      sandboxSessionId: session._id,
      triggeredBy: user._id,
      trigger: "manual",
    });

    return { success: true };
  },
});
