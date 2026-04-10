// @ts-nocheck
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import type { NormalizedEventType } from "../types";

/**
 * Webhook handler utilities for GitHub event ingestion.
 *
 * The HTTP endpoint (convex/http.ts) validates signatures and stores raw events.
 * These internal functions support event routing and entity extraction.
 */

// ---------------------------------------------------------------------------
// storeEvent — persist raw webhook payload to sourceControlEvents
// ---------------------------------------------------------------------------

export const storeEvent = internalMutation({
  args: {
    orgId: v.string(),
    providerType: v.string(),
    eventType: v.string(),
    action: v.optional(v.string()),
    entityType: v.string(),
    entityId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("sourceControlEvents", {
      orgId: args.orgId,
      providerType: args.providerType,
      eventType: args.eventType,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      payload: args.payload,
      status: "pending",
      retryCount: 0,
      receivedAt: Date.now(),
    });
    return eventId;
  },
});

// ---------------------------------------------------------------------------
// getEventById — load a single event for processing
// ---------------------------------------------------------------------------

export const getEventById = internalQuery({
  args: { eventId: v.id("sourceControlEvents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

// ---------------------------------------------------------------------------
// updateEventStatus — transition event processing state
// ---------------------------------------------------------------------------

export const updateEventStatus = internalMutation({
  args: {
    eventId: v.id("sourceControlEvents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("filtered"),
      v.literal("failed"),
    ),
    processedAt: v.optional(v.number()),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.processedAt !== undefined) updates.processedAt = args.processedAt;
    if (args.retryCount !== undefined) updates.retryCount = args.retryCount;
    await ctx.db.patch(args.eventId, updates);
  },
});

// ---------------------------------------------------------------------------
// extractEntityInfo — determine entityType + entityId from event type/payload
// ---------------------------------------------------------------------------

export function extractEntityInfo(
  eventType: string,
  payload: Record<string, any>,
): { entityType: string; entityId: string } {
  const repoFullName: string = payload.repository?.full_name ?? "unknown/unknown";

  switch (eventType as NormalizedEventType) {
    case "pull_request":
      return {
        entityType: "pr",
        entityId: `${repoFullName}#${payload.pull_request?.number ?? 0}`,
      };
    case "pull_request_review":
      return {
        entityType: "pr",
        entityId: `${repoFullName}#${payload.pull_request?.number ?? 0}`,
      };
    case "issues":
      return {
        entityType: "issue",
        entityId: `${repoFullName}#${payload.issue?.number ?? 0}`,
      };
    case "issue_comment":
      return {
        entityType: "issue",
        entityId: `${repoFullName}#${payload.issue?.number ?? 0}`,
      };
    case "push":
      return {
        entityType: "push",
        entityId: `${repoFullName}@${payload.ref ?? "unknown"}`,
      };
    case "deployment":
    case "deployment_status":
      return {
        entityType: "deployment",
        entityId: `${repoFullName}/deploy/${payload.deployment?.id ?? 0}`,
      };
    case "workflow_run":
      return {
        entityType: "deployment",
        entityId: `${repoFullName}/workflow/${payload.workflow_run?.id ?? 0}`,
      };
    case "installation":
      return {
        entityType: "installation",
        entityId: `install/${payload.installation?.id ?? 0}`,
      };
    case "repository":
      return {
        entityType: "repository",
        entityId: repoFullName,
      };
    default:
      return {
        entityType: "unknown",
        entityId: `${repoFullName}/${eventType}`,
      };
  }
}

// ---------------------------------------------------------------------------
// resolveOrgFromInstallation — look up orgId from installation_id
// ---------------------------------------------------------------------------

export const resolveOrgFromInstallation = internalQuery({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();
    return installation?.orgId ?? null;
  },
});

// ---------------------------------------------------------------------------
// getReposByFullName — look up repos by full name (supports monorepo multi-bind)
// ---------------------------------------------------------------------------

export const getReposByFullName = internalQuery({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// updateRepoFullName — rename repository binding on rename/transfer
// ---------------------------------------------------------------------------

export const updateRepoFullName = internalMutation({
  args: {
    oldFullName: v.string(),
    newFullName: v.string(),
  },
  handler: async (ctx, args) => {
    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.oldFullName))
      .collect();

    for (const repo of repos) {
      await ctx.db.patch(repo._id, { repoFullName: args.newFullName });
    }

    return repos.length;
  },
});

// ---------------------------------------------------------------------------
// markSyncStateStale — flag sync state as needing verification
// ---------------------------------------------------------------------------

export const markSyncStateStale = internalMutation({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return;

    const syncState = await ctx.db
      .query("sourceControlSyncState")
      .withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
      .unique();

    if (syncState) {
      await ctx.db.patch(syncState._id, { status: "stale" });
    }
  },
});

// ---------------------------------------------------------------------------
// updateSyncStateWebhook — touch lastWebhookAt for the repo
// ---------------------------------------------------------------------------

export const updateSyncStateWebhook = internalMutation({
  args: {
    repoFullName: v.string(),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return;

    const syncState = await ctx.db
      .query("sourceControlSyncState")
      .withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
      .unique();

    if (syncState) {
      await ctx.db.patch(syncState._id, {
        lastWebhookAt: Date.now(),
        status: "healthy",
      });
    }
  },
});
