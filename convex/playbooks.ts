import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const targetPlatformValidator = v.union(
  v.literal("salesforce_b2b"),
  v.literal("bigcommerce_b2b"),
  v.literal("sitecore"),
  v.literal("wordpress"),
  v.literal("none"),
  v.literal("platform_agnostic"),
);

const statusValidator = v.union(v.literal("draft"), v.literal("published"), v.literal("archived"));

const stepValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  workstreamId: v.optional(v.id("workstreams")),
  estimatedHours: v.optional(v.number()),
});

// ── Queries ──────────────────────────────────────────────────────────

/** List playbooks for a program with optional status filter, sorted by status then name. */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const playbooks = await ctx.db
      .query("playbooks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // JS-level filtering for optional status param
    let filtered = playbooks;
    if (args.status !== undefined) {
      filtered = filtered.filter((p) => p.status === args.status);
    }

    // Sort by status weight (published > draft > archived), then name
    const statusWeight: Record<string, number> = {
      published: 3,
      draft: 2,
      archived: 1,
    };
    filtered.sort((a, b) => {
      const sw = (statusWeight[b.status] ?? 0) - (statusWeight[a.status] ?? 0);
      if (sw !== 0) return sw;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  },
});

/** Retrieve a playbook by ID with resolved step details. */
export const get = query({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    // Resolve workstream names in steps
    const resolvedSteps = await Promise.all(
      playbook.steps.map(async (step) => {
        let workstreamName: string | undefined;
        let workstreamShortCode: string | undefined;
        if (step.workstreamId) {
          const ws = await ctx.db.get(step.workstreamId);
          if (ws) {
            workstreamName = ws.name;
            workstreamShortCode = ws.shortCode;
          }
        }
        return { ...step, workstreamName, workstreamShortCode };
      }),
    );

    return { ...playbook, resolvedSteps };
  },
});

export const listInstances = query({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    const instances = await ctx.db
      .query("playbookInstances")
      .withIndex("by_playbook", (q) => q.eq("playbookId", args.playbookId))
      .collect();

    // Enrich each instance with task progress
    const enriched = await Promise.all(
      instances.map(async (instance) => {
        let totalTasks = 0;
        let doneTasks = 0;
        const taskSummaries: { _id: string; title: string; status: string }[] = [];

        if (instance.generatedTaskIds) {
          for (const taskId of instance.generatedTaskIds) {
            const task = await ctx.db.get(taskId);
            if (task) {
              totalTasks++;
              if (task.status === "done") doneTasks++;
              taskSummaries.push({
                _id: task._id,
                title: task.title,
                status: task.status,
              });
            }
          }
        }

        return {
          ...instance,
          totalTasks,
          doneTasks,
          taskSummaries,
        };
      }),
    );

    // Sort by startedAt descending (newest first)
    enriched.sort((a, b) => b.startedAt - a.startedAt);

    return enriched;
  },
});

export const getInstance = query({
  args: { instanceId: v.id("playbookInstances") },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new ConvexError("Playbook instance not found");
    await assertOrgAccess(ctx, instance.orgId);

    // Resolve generated tasks
    const resolvedTasks: { _id: string; title: string; status: string }[] = [];
    let doneTasks = 0;

    if (instance.generatedTaskIds) {
      for (const taskId of instance.generatedTaskIds) {
        const task = await ctx.db.get(taskId);
        if (task) {
          resolvedTasks.push({
            _id: task._id,
            title: task.title,
            status: task.status,
          });
          if (task.status === "done") doneTasks++;
        }
      }
    }

    // Resolve playbook name
    const playbook = await ctx.db.get(instance.playbookId);
    const playbookName = playbook?.name;

    return {
      ...instance,
      resolvedTasks,
      totalTasks: resolvedTasks.length,
      doneTasks,
      playbookName,
    };
  },
});

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Create a new playbook with defined steps.
 * @param orgId - Organization ID
 * @param programId - Parent program
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    description: v.optional(v.string()),
    targetPlatform: targetPlatformValidator,
    steps: v.array(stepValidator),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const playbookId = await ctx.db.insert("playbooks", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      description: args.description,
      targetPlatform: args.targetPlatform,
      steps: args.steps,
      status: args.status ?? "draft",
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "playbook",
      entityId: playbookId as string,
      action: "create",
      description: `Created playbook "${args.name}"`,
    });

    return playbookId;
  },
});

/**
 * Update playbook properties (name, steps, description).
 * @param playbookId - The playbook to update
 */
export const update = mutation({
  args: {
    playbookId: v.id("playbooks"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    targetPlatform: v.optional(targetPlatformValidator),
    steps: v.optional(v.array(stepValidator)),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    const { playbookId: _, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.playbookId, patch);

      await logAuditEvent(ctx, {
        orgId: playbook.orgId,
        programId: playbook.programId as string,
        entityType: "playbook",
        entityId: args.playbookId as string,
        action: "update",
        description: `Updated playbook "${playbook.name}"`,
        metadata: { updatedFields: Object.keys(patch) },
      });
    }
  },
});

/** Publish a draft playbook, making it available for instantiation. */
export const publish = mutation({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    if (playbook.status !== "draft") {
      throw new ConvexError(
        `Only draft playbooks can be published. Current status: ${playbook.status}`,
      );
    }

    await ctx.db.patch(args.playbookId, { status: "published" });

    await logAuditEvent(ctx, {
      orgId: playbook.orgId,
      programId: playbook.programId as string,
      entityType: "playbook",
      entityId: args.playbookId as string,
      action: "status_change",
      description: `Published playbook "${playbook.name}"`,
      metadata: { oldStatus: "draft", newStatus: "published" },
    });
  },
});

export const archive = mutation({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    const oldStatus = playbook.status;
    await ctx.db.patch(args.playbookId, { status: "archived" });

    await logAuditEvent(ctx, {
      orgId: playbook.orgId,
      programId: playbook.programId as string,
      entityType: "playbook",
      entityId: args.playbookId as string,
      action: "status_change",
      description: `Archived playbook "${playbook.name}"`,
      metadata: { oldStatus, newStatus: "archived" },
    });
  },
});

/** Delete a playbook and all its associated instances. */
export const remove = mutation({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    if (playbook.status !== "draft") {
      throw new ConvexError(
        "Only draft playbooks can be deleted. Archive the playbook first, or it must be in 'draft' status.",
      );
    }

    await ctx.db.delete(args.playbookId);

    await logAuditEvent(ctx, {
      orgId: playbook.orgId,
      programId: playbook.programId as string,
      entityType: "playbook",
      entityId: args.playbookId as string,
      action: "delete",
      description: `Deleted playbook "${playbook.name}"`,
    });
  },
});

/**
 * Create a running instance of a published playbook with step tracking.
 * @param playbookId - Source playbook to instantiate
 * @param instanceName - Display name for this run
 */
export const instantiate = mutation({
  args: {
    playbookId: v.id("playbooks"),
    instanceName: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Load playbook, verify it's published
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new ConvexError("Playbook not found");
    await assertOrgAccess(ctx, playbook.orgId);

    if (playbook.status !== "published") {
      throw new ConvexError(
        `Only published playbooks can be instantiated. Current status: ${playbook.status}`,
      );
    }

    // 2. Create a playbookInstance record
    const instanceId = await ctx.db.insert("playbookInstances", {
      orgId: playbook.orgId,
      programId: playbook.programId,
      playbookId: args.playbookId,
      name: args.instanceName,
      status: "active",
      startedAt: Date.now(),
    });

    // 3. For each step, insert a task directly
    const generatedTaskIds: any[] = [];
    for (const step of playbook.steps) {
      const taskId = await ctx.db.insert("tasks", {
        orgId: playbook.orgId,
        programId: playbook.programId,
        title: step.title,
        description: step.description,
        workstreamId: step.workstreamId,
        priority: "medium",
        status: "backlog",
      });
      generatedTaskIds.push(taskId);

      // 7. Log individual audit events for each task creation
      await logAuditEvent(ctx, {
        orgId: playbook.orgId,
        programId: playbook.programId as string,
        entityType: "task",
        entityId: taskId as string,
        action: "create",
        description: `Created task "${step.title}" from playbook "${playbook.name}"`,
        metadata: { playbookId: args.playbookId, instanceId },
      });
    }

    // 5. Update the instance with generatedTaskIds
    await ctx.db.patch(instanceId, { generatedTaskIds });

    // 6. Log audit event for the instantiation
    await logAuditEvent(ctx, {
      orgId: playbook.orgId,
      programId: playbook.programId as string,
      entityType: "playbookInstance",
      entityId: instanceId as string,
      action: "create",
      description: `Instantiated playbook "${playbook.name}" as "${args.instanceName}" with ${generatedTaskIds.length} tasks`,
      metadata: {
        playbookId: args.playbookId,
        taskCount: generatedTaskIds.length,
      },
    });

    // 8. Return the instance ID
    return instanceId;
  },
});
