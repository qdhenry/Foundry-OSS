import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

/**
 * Activity event helpers — write-side for sourceControlActivityEvents.
 *
 * Called from the webhook processor when PR lifecycle events arrive.
 * Query-side is in prLifecycle.ts (getActivityFeed).
 */

export const insertActivityEvent = internalMutation({
  args: {
    orgId: v.string(),
    taskId: v.optional(v.id("tasks")),
    prId: v.optional(v.id("sourceControlPullRequests")),
    eventType: v.union(
      v.literal("pr_created"),
      v.literal("pr_merged"),
      v.literal("pr_closed"),
      v.literal("pr_reopened"),
      v.literal("pr_converted_to_draft"),
      v.literal("pr_ready_for_review"),
      v.literal("commit_pushed"),
      v.literal("review_submitted"),
      v.literal("review_requested"),
      v.literal("ci_status_changed"),
      v.literal("conflict_detected"),
      v.literal("conflict_resolved"),
      v.literal("description_updated"),
    ),
    actorLogin: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sourceControlActivityEvents", {
      orgId: args.orgId,
      taskId: args.taskId,
      prId: args.prId,
      eventType: args.eventType,
      actorLogin: args.actorLogin,
      summary: args.summary,
      metadata: args.metadata,
      occurredAt: args.occurredAt,
    });
  },
});
