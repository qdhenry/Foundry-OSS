import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Task dependency synchronization via GitHub parent issues — DB layer.
 *
 * Creates parent issues per workstream/sprint with GitHub task list syntax
 * (`- [ ] #123 - Task title`) that GitHub renders as progress bars.
 *
 * Provider-calling actions are in dependencySyncActions.ts ("use node").
 */

// ---------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------

/**
 * Get the parent issue tracking record for a workstream/sprint combination.
 * Parent issues are stored as sourceControlIssueMappings with a sentinel
 * taskId — we use a dedicated table field pattern instead.
 *
 * For V1, we track parent issues by storing the issue number on the sprint
 * or using a convention in sourceControlIssueMappings.
 * We'll use a simple lookup: find the mapping whose issueUrl contains
 * "[Task Tracker]" or query by a special tag.
 *
 * Simpler approach: store parent issue info alongside child mappings.
 */

export const getChildIssueMappings = internalQuery({
  args: {
    workstreamId: v.id("workstreams"),
    sprintId: v.id("sprints"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    // Get all tasks in this workstream + sprint
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    const wsFilteredTasks = tasks.filter((t) => t.workstreamId === args.workstreamId);

    // Get issue mappings for these tasks in this repo
    const mappings = [];
    for (const task of wsFilteredTasks) {
      const mapping = await ctx.db
        .query("sourceControlIssueMappings")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .first();
      if (mapping && mapping.repositoryId === args.repositoryId) {
        mappings.push({ task, mapping });
      }
    }

    return mappings;
  },
});

export const getSprintWorkstreamContext = internalQuery({
  args: {
    workstreamId: v.id("workstreams"),
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");

    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");

    return { workstream, sprint };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Store a parent issue reference. We reuse sourceControlIssueMappings
 * but need a way to distinguish parent issues from regular task issues.
 * For V1, we track parent issues in a lightweight way: the first task in
 * the sprint acts as the anchor, and we store a special mapping.
 *
 * Alternative: store parent issue number in sprint metadata. Since
 * sprints don't have a parentIssueNumber field, we'll create a simple
 * convention using an internal record.
 */

export const storeParentIssueRef = internalMutation({
  args: {
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    workstreamId: v.id("workstreams"),
    sprintId: v.id("sprints"),
    issueNumber: v.number(),
    issueUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Store as a sourceControlEvent with a special entityType for tracking
    // This is a lightweight V1 approach — a dedicated table could be added later
    await ctx.db.insert("sourceControlEvents", {
      orgId: args.orgId,
      providerType: "github",
      eventType: "parent_issue_created",
      entityType: "parent_issue",
      entityId: `${args.workstreamId}/${args.sprintId}`,
      payload: {
        repositoryId: args.repositoryId,
        workstreamId: args.workstreamId,
        sprintId: args.sprintId,
        issueNumber: args.issueNumber,
        issueUrl: args.issueUrl,
      },
      status: "processed",
      retryCount: 0,
      receivedAt: Date.now(),
      processedAt: Date.now(),
    });
  },
});

export const getParentIssueRef = internalQuery({
  args: {
    workstreamId: v.id("workstreams"),
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const entityId = `${args.workstreamId}/${args.sprintId}`;
    const record = await ctx.db
      .query("sourceControlEvents")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "parent_issue").eq("entityId", entityId).eq("status", "processed"),
      )
      .first();

    if (!record) return null;

    const payload = record.payload as {
      repositoryId: string;
      issueNumber: number;
      issueUrl: string;
    };
    return payload;
  },
});
