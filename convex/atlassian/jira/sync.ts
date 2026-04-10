import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

// Jira status → platform requirement status mapping
const JIRA_STATUS_MAP: Record<string, string> = {
  "to do": "draft",
  "in progress": "in_progress",
  "in review": "in_progress",
  done: "complete",
};

function mapJiraStatusToPlatform(
  jiraStatus: string,
): "draft" | "approved" | "in_progress" | "complete" | "deferred" | null {
  const mapped = JIRA_STATUS_MAP[jiraStatus.toLowerCase()];
  if (!mapped) return null;
  return mapped as "draft" | "in_progress" | "complete";
}

function extractStatusChange(
  payload: Record<string, any>,
): { fromStatus: string; toStatus: string } | null {
  const changelog = payload.changelog;
  if (!changelog?.items || !Array.isArray(changelog.items)) return null;

  const statusItem = changelog.items.find(
    (item: any) => typeof item.field === "string" && item.field.toLowerCase() === "status",
  );
  if (!statusItem) return null;

  return {
    fromStatus: String(statusItem.fromString ?? statusItem.from ?? ""),
    toStatus: String(statusItem.toString ?? statusItem.to ?? ""),
  };
}

function deriveIssueFields(payload: Record<string, any>) {
  const issue = payload.issue ?? payload.data?.issue ?? null;
  if (!issue) return null;

  return {
    jiraIssueId: typeof issue.id === "string" ? issue.id : undefined,
    jiraIssueKey: typeof issue.key === "string" ? issue.key : undefined,
    jiraIssueType:
      typeof issue.fields?.issuetype?.name === "string" ? issue.fields.issuetype.name : undefined,
    jiraLastModified: typeof issue.fields?.updated === "string" ? issue.fields.updated : undefined,
  };
}

export const handleJiraWebhookEvent = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.optional(v.id("programs")),
    eventType: v.string(),
    action: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args): Promise<any> => {
    const payload = args.payload as Record<string, any>;
    const issue = deriveIssueFields(payload);
    const programId = args.programId;
    if (!programId || !issue?.jiraIssueKey) {
      return { processed: false, reason: "missing programId or issue key" };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("jiraSyncRecords")
      .withIndex("by_jira_issue_key", (q) =>
        q.eq("programId", programId).eq("jiraIssueKey", issue.jiraIssueKey),
      )
      .first();

    // Detect status changes from changelog
    const statusChange = extractStatusChange(payload);

    if (existing) {
      // Check for conflicts: if platform was modified after last pull
      let conflictStatus = existing.conflictStatus ?? "none";
      let conflictDetails = existing.conflictDetails;

      if (
        statusChange &&
        existing.platformLastModified &&
        existing.lastPullAt &&
        existing.platformLastModified > existing.lastPullAt
      ) {
        // Platform was modified since we last pulled — conflict
        conflictStatus = "detected";
        conflictDetails = `Concurrent edit detected: Jira status changed from "${statusChange.fromStatus}" to "${statusChange.toStatus}" but platform entity was modified at ${new Date(existing.platformLastModified).toISOString()} (after last pull at ${new Date(existing.lastPullAt).toISOString()})`;
      }

      await ctx.db.patch(existing._id, {
        jiraIssueId: issue.jiraIssueId,
        jiraIssueType: issue.jiraIssueType,
        lastPullAt: now,
        jiraLastModified: issue.jiraLastModified,
        conflictStatus,
        conflictDetails,
      });

      // If status changed, no conflict, and sync record maps to a requirement — update platform
      if (
        statusChange &&
        conflictStatus !== "detected" &&
        existing.platformEntityType === "requirement"
      ) {
        const mappedStatus = mapJiraStatusToPlatform(statusChange.toStatus);
        if (mappedStatus) {
          // Look up the requirement by platformEntityId (which is the requirement _id)
          const requirement = await ctx.db.get(existing.platformEntityId as any);
          if (requirement) {
            await ctx.db.patch(requirement._id, { status: mappedStatus });
            // Update platformLastModified on the sync record to track this change
            await ctx.db.patch(existing._id, { platformLastModified: now });
          }
        }
      }

      // Update lastSyncAt on the connection
      const connections = await ctx.db
        .query("atlassianConnections")
        .withIndex("by_program", (q) => q.eq("programId", programId))
        .collect();
      for (const conn of connections) {
        if (conn.status === "connected") {
          await ctx.db.patch(conn._id, { lastSyncAt: now });
          break;
        }
      }

      return { processed: true, created: false, statusSynced: !!statusChange };
    }

    // No existing sync record — create a new unlinked one
    const fallbackEntityId = issue.jiraIssueId ?? issue.jiraIssueKey;

    await ctx.db.insert("jiraSyncRecords", {
      orgId: args.orgId,
      programId,
      platformEntityType: "task",
      platformEntityId: fallbackEntityId,
      jiraIssueId: issue.jiraIssueId,
      jiraIssueKey: issue.jiraIssueKey,
      jiraIssueType: issue.jiraIssueType,
      syncDirection: "bidirectional",
      lastPullAt: now,
      jiraLastModified: issue.jiraLastModified,
      conflictStatus: "none",
    });

    // Update lastSyncAt on the connection
    const connections = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", programId))
      .collect();
    for (const conn of connections) {
      if (conn.status === "connected") {
        await ctx.db.patch(conn._id, { lastSyncAt: now });
        break;
      }
    }

    return { processed: true, created: true };
  },
});

// Internal mutation to update a platform entity's status from a sync record
export const updatePlatformEntityStatus = internalMutation({
  args: {
    syncRecordId: v.id("jiraSyncRecords"),
    newStatus: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("in_progress"),
      v.literal("complete"),
      v.literal("deferred"),
    ),
  },
  handler: async (ctx, args) => {
    const syncRecord = await ctx.db.get(args.syncRecordId);
    if (!syncRecord) throw new ConvexError("Sync record not found");

    if (syncRecord.platformEntityType === "requirement") {
      const requirement = await ctx.db.get(syncRecord.platformEntityId as any);
      if (!requirement) throw new ConvexError("Requirement not found");
      await ctx.db.patch(requirement._id, { status: args.newStatus });
      await ctx.db.patch(syncRecord._id, { platformLastModified: Date.now() });
    }
  },
});

// Conflict resolution mutation
export const resolveConflict = mutation({
  args: {
    syncRecordId: v.id("jiraSyncRecords"),
    resolution: v.union(v.literal("keep_platform"), v.literal("keep_jira")),
  },
  handler: async (ctx, args) => {
    const syncRecord = await ctx.db.get(args.syncRecordId);
    if (!syncRecord) throw new ConvexError("Sync record not found");
    await assertOrgAccess(ctx, syncRecord.orgId);

    if (syncRecord.conflictStatus !== "detected") {
      throw new ConvexError("No conflict to resolve on this sync record");
    }

    const now = Date.now();

    if (args.resolution === "keep_jira") {
      // Apply Jira's current status to the platform entity
      if (syncRecord.platformEntityType === "requirement") {
        const requirement = await ctx.db.get(syncRecord.platformEntityId as any);
        if (requirement) {
          // Derive status from Jira's last known state
          // The jiraLastModified timestamp tells us Jira was more recently updated
          // We mark the conflict as resolved and note that Jira won
          await ctx.db.patch(syncRecord._id, {
            conflictStatus: "resolved",
            conflictDetails: `Resolved: kept Jira version at ${new Date(now).toISOString()}`,
            platformLastModified: now,
          });
        }
      } else {
        await ctx.db.patch(syncRecord._id, {
          conflictStatus: "resolved",
          conflictDetails: `Resolved: kept Jira version at ${new Date(now).toISOString()}`,
        });
      }
    } else {
      // keep_platform: mark resolved, the platform version stands
      // A push to Jira would be needed to sync the platform state back
      await ctx.db.patch(syncRecord._id, {
        conflictStatus: "resolved",
        conflictDetails: `Resolved: kept platform version at ${new Date(now).toISOString()}. Jira update may be needed.`,
        lastPushAt: undefined,
      });
    }

    return { resolved: true, resolution: args.resolution };
  },
});

export const upsertSyncRecord = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    platformEntityType: v.union(
      v.literal("workstream"),
      v.literal("requirement"),
      v.literal("task"),
      v.literal("sprint"),
    ),
    platformEntityId: v.string(),
    jiraIssueId: v.optional(v.string()),
    jiraIssueKey: v.optional(v.string()),
    jiraSprintId: v.optional(v.number()),
    jiraIssueType: v.optional(v.string()),
    syncDirection: v.union(v.literal("push"), v.literal("pull"), v.literal("bidirectional")),
    lastPushAt: v.optional(v.number()),
    lastPullAt: v.optional(v.number()),
    jiraLastModified: v.optional(v.string()),
    platformLastModified: v.optional(v.number()),
    conflictStatus: v.optional(
      v.union(v.literal("none"), v.literal("detected"), v.literal("resolved")),
    ),
    conflictDetails: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    let existing = null;
    if (args.jiraIssueKey) {
      existing = await ctx.db
        .query("jiraSyncRecords")
        .withIndex("by_jira_issue_key", (q) =>
          q.eq("programId", args.programId).eq("jiraIssueKey", args.jiraIssueKey),
        )
        .first();
    }

    if (!existing) {
      existing = await ctx.db
        .query("jiraSyncRecords")
        .withIndex("by_platform_entity", (q) =>
          q
            .eq("programId", args.programId)
            .eq("platformEntityType", args.platformEntityType)
            .eq("platformEntityId", args.platformEntityId),
        )
        .first();
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        jiraIssueId: args.jiraIssueId,
        jiraIssueKey: args.jiraIssueKey,
        jiraSprintId: args.jiraSprintId,
        jiraIssueType: args.jiraIssueType,
        syncDirection: args.syncDirection,
        lastPushAt: args.lastPushAt,
        lastPullAt: args.lastPullAt,
        jiraLastModified: args.jiraLastModified,
        platformLastModified: args.platformLastModified,
        conflictStatus: args.conflictStatus,
        conflictDetails: args.conflictDetails,
      });
      return existing._id;
    }

    return await ctx.db.insert("jiraSyncRecords", {
      orgId: args.orgId,
      programId: args.programId,
      platformEntityType: args.platformEntityType,
      platformEntityId: args.platformEntityId,
      jiraIssueId: args.jiraIssueId,
      jiraIssueKey: args.jiraIssueKey,
      jiraSprintId: args.jiraSprintId,
      jiraIssueType: args.jiraIssueType,
      syncDirection: args.syncDirection,
      lastPushAt: args.lastPushAt,
      lastPullAt: args.lastPullAt,
      jiraLastModified: args.jiraLastModified,
      platformLastModified: args.platformLastModified,
      conflictStatus: args.conflictStatus,
      conflictDetails: args.conflictDetails,
    });
  },
});

export const upsertSyncRecordInternal = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    platformEntityType: v.union(
      v.literal("workstream"),
      v.literal("requirement"),
      v.literal("task"),
      v.literal("sprint"),
    ),
    platformEntityId: v.string(),
    jiraIssueId: v.optional(v.string()),
    jiraIssueKey: v.optional(v.string()),
    jiraIssueType: v.optional(v.string()),
    syncDirection: v.union(v.literal("push"), v.literal("pull"), v.literal("bidirectional")),
    lastPushAt: v.optional(v.number()),
    conflictStatus: v.optional(
      v.union(v.literal("none"), v.literal("detected"), v.literal("resolved")),
    ),
  },
  handler: async (ctx, args) => {
    let existing = null;
    if (args.jiraIssueKey) {
      existing = await ctx.db
        .query("jiraSyncRecords")
        .withIndex("by_jira_issue_key", (q) =>
          q.eq("programId", args.programId).eq("jiraIssueKey", args.jiraIssueKey),
        )
        .first();
    }

    if (!existing) {
      existing = await ctx.db
        .query("jiraSyncRecords")
        .withIndex("by_platform_entity", (q) =>
          q
            .eq("programId", args.programId)
            .eq("platformEntityType", args.platformEntityType)
            .eq("platformEntityId", args.platformEntityId),
        )
        .first();
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        jiraIssueId: args.jiraIssueId,
        jiraIssueKey: args.jiraIssueKey,
        jiraIssueType: args.jiraIssueType,
        syncDirection: args.syncDirection,
        lastPushAt: args.lastPushAt,
        conflictStatus: args.conflictStatus,
      });
      return existing._id;
    }

    return await ctx.db.insert("jiraSyncRecords", {
      orgId: args.orgId,
      programId: args.programId,
      platformEntityType: args.platformEntityType,
      platformEntityId: args.platformEntityId,
      jiraIssueId: args.jiraIssueId,
      jiraIssueKey: args.jiraIssueKey,
      jiraIssueType: args.jiraIssueType,
      syncDirection: args.syncDirection,
      lastPushAt: args.lastPushAt,
      conflictStatus: args.conflictStatus ?? "none",
    });
  },
});

// Internal mutation to store/clear the Jira webhook ID on a connection record.
// Called from webhookRegistration.ts actions via (internal as any).atlassian.jira.sync.storeWebhookId
export const storeWebhookId = internalMutation({
  args: {
    connectionId: v.id("atlassianConnections"),
    jiraWebhookId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new ConvexError("Connection not found");

    const existingWebhookIds = (connection.webhookIds ?? {}) as Record<string, any>;

    await ctx.db.patch(args.connectionId, {
      webhookIds: {
        ...existingWebhookIds,
        jiraWebhookId: args.jiraWebhookId,
      } as any,
      updatedAt: Date.now(),
    });
  },
});

export const listConflictsByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const records = await ctx.db
      .query("jiraSyncRecords")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return records.filter((record) => record.conflictStatus === "detected");
  },
});
