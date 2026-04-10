import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

type ProviderType = "jira" | "confluence";

export const storeEvent = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.optional(v.id("programs")),
    providerType: v.union(v.literal("jira"), v.literal("confluence")),
    atlassianSiteId: v.optional(v.string()),
    eventType: v.string(),
    action: v.optional(v.string()),
    entityType: v.string(),
    entityId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("atlassianWebhookEvents", {
      orgId: args.orgId,
      programId: args.programId,
      providerType: args.providerType,
      atlassianSiteId: args.atlassianSiteId,
      eventType: args.eventType,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      payload: args.payload,
      status: "pending",
      retryCount: 0,
      receivedAt: Date.now(),
    });
  },
});

export const getEventById = internalQuery({
  args: { eventId: v.id("atlassianWebhookEvents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

export const updateEventStatus = internalMutation({
  args: {
    eventId: v.id("atlassianWebhookEvents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("filtered"),
      v.literal("failed"),
    ),
    retryCount: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.retryCount !== undefined) updates.retryCount = args.retryCount;
    if (args.processedAt !== undefined) updates.processedAt = args.processedAt;
    if (args.lastError !== undefined) updates.lastError = args.lastError;
    await ctx.db.patch(args.eventId, updates);
  },
});

export const resolveProgramFromJiraPayload = internalQuery({
  args: {
    atlassianSiteId: v.optional(v.string()),
    jiraProjectKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.atlassianSiteId) return null;

    const candidates = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_site_id", (q) => q.eq("atlassianSiteId", args.atlassianSiteId))
      .collect();

    const connected = candidates.filter((connection) => connection.status === "connected");
    if (connected.length === 0) return null;

    const exactMatch = args.jiraProjectKey
      ? connected.find(
          (connection) =>
            connection.jiraProjectKey?.toLowerCase() === args.jiraProjectKey?.toLowerCase(),
        )
      : undefined;

    const resolved = exactMatch ?? connected[0];

    return {
      orgId: resolved.orgId,
      programId: resolved.programId,
      connectionId: resolved._id,
    };
  },
});

export const resolveProgramFromConfluencePayload = internalQuery({
  args: {
    atlassianSiteId: v.optional(v.string()),
    confluenceSpaceKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.atlassianSiteId) return null;

    const candidates = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_site_id", (q) => q.eq("atlassianSiteId", args.atlassianSiteId))
      .collect();

    const connected = candidates.filter((connection) => connection.status === "connected");
    if (connected.length === 0) return null;

    const exactMatch = args.confluenceSpaceKey
      ? connected.find(
          (connection) =>
            connection.confluenceSpaceKey?.toLowerCase() === args.confluenceSpaceKey?.toLowerCase(),
        )
      : undefined;

    const resolved = exactMatch ?? connected[0];

    return {
      orgId: resolved.orgId,
      programId: resolved.programId,
      connectionId: resolved._id,
    };
  },
});

export function extractEntityInfo(
  providerType: ProviderType,
  payload: Record<string, any>,
): { entityType: string; entityId: string } {
  if (providerType === "jira") {
    const issueKey = payload.issue?.key;
    const issueId = payload.issue?.id;
    const sprintId = payload.sprint?.id;

    if (issueKey || issueId) {
      return {
        entityType: "issue",
        entityId: String(issueKey ?? issueId),
      };
    }

    if (sprintId) {
      return {
        entityType: "sprint",
        entityId: String(sprintId),
      };
    }

    return {
      entityType: "jira_event",
      entityId: String(payload.timestamp ?? Date.now()),
    };
  }

  const pageId = payload.page?.id ?? payload.content?.id ?? payload.id;
  if (pageId) {
    return {
      entityType: "page",
      entityId: String(pageId),
    };
  }

  const spaceKey = payload.space?.key ?? payload.content?.space?.key;
  if (spaceKey) {
    return {
      entityType: "space",
      entityId: String(spaceKey),
    };
  }

  return {
    entityType: "confluence_event",
    entityId: String(payload.timestamp ?? Date.now()),
  };
}
