import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const priorityValidator = v.union(
  v.literal("critical"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

const statusValidator = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done"),
);

// ── Queries ──────────────────────────────────────────────────────────

/**
 * List tasks for a program with optional filters (workstream, sprint, status,
 * priority, assignee). Returns enriched records with resolved names.
 * @param programId - The program to query
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    sprintId: v.optional(v.id("sprints")),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // JS-level filtering for optional params (cannot compound-index these)
    let filtered = tasks;
    if (args.workstreamId !== undefined) {
      filtered = filtered.filter((t) => t.workstreamId === args.workstreamId);
    }
    if (args.sprintId !== undefined) {
      filtered = filtered.filter((t) => t.sprintId === args.sprintId);
    }
    if (args.status !== undefined) {
      filtered = filtered.filter((t) => t.status === args.status);
    }
    if (args.priority !== undefined) {
      filtered = filtered.filter((t) => t.priority === args.priority);
    }
    if (args.assigneeId !== undefined) {
      filtered = filtered.filter((t) => t.assigneeId === args.assigneeId);
    }

    // Resolve assignee names, sprint names, workstream names
    const enriched = await Promise.all(
      filtered.map(async (task) => {
        let assigneeName: string | undefined;
        if (task.assigneeId) {
          const assignee = await ctx.db.get(task.assigneeId);
          if (assignee) assigneeName = assignee.name;
        }

        let sprintName: string | undefined;
        if (task.sprintId) {
          const sprint = await ctx.db.get(task.sprintId);
          if (sprint) sprintName = sprint.name;
        }

        let workstreamName: string | undefined;
        let workstreamShortCode: string | undefined;
        if (task.workstreamId) {
          const ws = await ctx.db.get(task.workstreamId);
          if (ws) {
            workstreamName = ws.name;
            workstreamShortCode = ws.shortCode;
          }
        }

        let requirementTitle: string | undefined;
        if (task.requirementId) {
          const req = await ctx.db.get(task.requirementId);
          if (req) requirementTitle = req.title;
        }

        return {
          ...task,
          assigneeName,
          sprintName,
          workstreamName,
          workstreamShortCode,
          requirementTitle,
        };
      }),
    );

    // Sort by priority weight descending, then title ascending
    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    enriched.sort((a, b) => {
      const pw = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
      if (pw !== 0) return pw;
      return a.title.localeCompare(b.title);
    });

    return enriched;
  },
});

/**
 * Retrieve a single task by ID with resolved assignee, sprint, workstream, requirement,
 * blocker, and active sandbox session details.
 * @param taskId - The task to fetch
 */
export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    // Resolve assignee
    let assigneeName: string | undefined;
    if (task.assigneeId) {
      const assignee = await ctx.db.get(task.assigneeId);
      if (assignee) assigneeName = assignee.name;
    }

    // Resolve sprint
    let sprintName: string | undefined;
    if (task.sprintId) {
      const sprint = await ctx.db.get(task.sprintId);
      if (sprint) sprintName = sprint.name;
    }

    // Resolve workstream
    let workstreamName: string | undefined;
    let workstreamShortCode: string | undefined;
    if (task.workstreamId) {
      const ws = await ctx.db.get(task.workstreamId);
      if (ws) {
        workstreamName = ws.name;
        workstreamShortCode = ws.shortCode;
      }
    }

    // Resolve requirement
    let requirementTitle: string | undefined;
    let requirementRefId: string | undefined;
    if (task.requirementId) {
      const req = await ctx.db.get(task.requirementId);
      if (req) {
        requirementTitle = req.title;
        requirementRefId = req.refId;
      }
    }

    // Resolve blockedBy tasks
    const resolvedBlockedBy: { _id: string; title: string; status: string }[] = [];
    if (task.blockedBy) {
      for (const blockId of task.blockedBy) {
        const blocker = await ctx.db.get(blockId);
        if (blocker) {
          resolvedBlockedBy.push({
            _id: blocker._id,
            title: blocker.title,
            status: blocker.status,
          });
        }
      }
    }

    const db = ctx.db as any;
    const sandboxSessions = await db
      .query("sandboxSessions")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .collect();

    const activeSandboxSession = sandboxSessions
      .filter(
        (session: { status: string }) =>
          session.status !== "completed" &&
          session.status !== "failed" &&
          session.status !== "cancelled",
      )
      .sort((a: { startedAt: number }, b: { startedAt: number }) => b.startedAt - a.startedAt)[0];

    return {
      ...task,
      assigneeName,
      sprintName,
      workstreamName,
      workstreamShortCode,
      requirementTitle,
      requirementRefId,
      resolvedBlockedBy,
      activeSandboxSessionId: activeSandboxSession?._id,
    };
  },
});

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Create a new task within a program.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param title - Task title
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    title: v.string(),
    description: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    storyPoints: v.optional(v.number()),
    workstreamId: v.optional(v.id("workstreams")),
    sprintId: v.optional(v.id("sprints")),
    requirementId: v.optional(v.id("requirements")),
    assigneeId: v.optional(v.id("users")),
    priority: priorityValidator,
    status: v.optional(statusValidator),
    blockedBy: v.optional(v.array(v.id("tasks"))),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const taskId = await ctx.db.insert("tasks", {
      orgId: args.orgId,
      programId: args.programId,
      title: args.title,
      description: args.description,
      acceptanceCriteria: args.acceptanceCriteria,
      storyPoints: args.storyPoints,
      workstreamId: args.workstreamId,
      sprintId: args.sprintId,
      requirementId: args.requirementId,
      assigneeId: args.assigneeId,
      priority: args.priority,
      status: args.status ?? "backlog",
      blockedBy: args.blockedBy,
      dueDate: args.dueDate,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "task",
      entityId: taskId as string,
      action: "create",
      description: `Created task "${args.title}"`,
    });

    // Create design snapshot if design context exists
    await ctx.scheduler.runAfter(0, internal.taskDesignSnapshots.createForTask, {
      orgId: args.orgId,
      taskId,
      programId: args.programId,
      workstreamId: args.workstreamId,
      requirementId: args.requirementId,
    });

    return taskId;
  },
});

/**
 * Update task fields such as title, description, priority, assignee, or sprint.
 * @param taskId - The task to update
 */
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    storyPoints: v.optional(v.number()),
    workstreamId: v.optional(v.id("workstreams")),
    sprintId: v.optional(v.id("sprints")),
    requirementId: v.optional(v.id("requirements")),
    assigneeId: v.optional(v.id("users")),
    priority: v.optional(priorityValidator),
    blockedBy: v.optional(v.array(v.id("tasks"))),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const { taskId: _, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.taskId, patch);

      await logAuditEvent(ctx, {
        orgId: task.orgId,
        programId: task.programId as string,
        entityType: "task",
        entityId: args.taskId as string,
        action: "update",
        description: `Updated task "${task.title}"`,
        metadata: { updatedFields: Object.keys(patch) },
      });
    }
  },
});

/**
 * Transition a task to a new status (backlog, todo, in_progress, review, done).
 * @param taskId - The task to update
 * @param status - New status value
 */
export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const oldStatus = task.status;
    await ctx.db.patch(args.taskId, { status: args.status });

    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId as string,
      entityType: "task",
      entityId: args.taskId as string,
      action: "status_change",
      description: `Changed task "${task.title}" status from ${oldStatus} to ${args.status}`,
      metadata: { oldStatus, newStatus: args.status },
    });
  },
});

/**
 * Delete a task and all its subtasks.
 * @param taskId - The task to delete
 */
export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    if (task.status !== "backlog") {
      throw new ConvexError(
        "Only tasks with status 'backlog' can be deleted. Move the task to 'backlog' first.",
      );
    }

    await ctx.db.delete(args.taskId);

    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId as string,
      entityType: "task",
      entityId: args.taskId as string,
      action: "delete",
      description: `Deleted task "${task.title}"`,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations for sandbox orchestration
// ---------------------------------------------------------------------------

export const updateStatusInternal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    const oldStatus = task.status;
    if (oldStatus === args.status) return;
    await ctx.db.patch(args.taskId, { status: args.status });
    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId as string,
      entityType: "task",
      entityId: args.taskId as string,
      action: "status_change",
      description: `Agent changed task "${task.title}" status from ${oldStatus} to ${args.status}`,
      metadata: { oldStatus, newStatus: args.status, automated: true },
    });
  },
});

// ---------------------------------------------------------------------------
// Internal queries for Phase 3 AI features
// ---------------------------------------------------------------------------

/**
 * Count tasks in a sprint grouped by status, with total story points.
 * @param sprintId - The sprint to query
 */
export const countBySprint = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    return tasks.length;
  },
});

export const getBySprint = internalQuery({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
  },
});

export const setWorktreeBranch = internalMutation({
  args: {
    taskId: v.id("tasks"),
    worktreeBranch: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    if (!task.worktreeBranch) {
      await ctx.db.patch(args.taskId, { worktreeBranch: args.worktreeBranch });
    }
  },
});

export const getInternal = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getByProgram = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Public queries for sprint planning — unassigned tasks
// ---------------------------------------------------------------------------

/**
 * List tasks that have no sprint assignment for a given workstream. Used by
 * sprint planning to show available tasks.
 * @param workstreamId - Filter to this workstream
 * @param programId - Parent program
 */
export const listUnassignedByWorkstream = query({
  args: {
    workstreamId: v.id("workstreams"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();

    // Filter to unassigned (no sprintId) and same program
    const unassigned = tasks.filter((t) => !t.sprintId && t.programId === args.programId);

    // Resolve requirement titles
    const enriched = await Promise.all(
      unassigned.map(async (task) => {
        let requirementTitle: string | undefined;
        let requirementRefId: string | undefined;
        if (task.requirementId) {
          const req = await ctx.db.get(task.requirementId);
          if (req) {
            requirementTitle = req.title;
            requirementRefId = req.refId;
          }
        }
        return { ...task, requirementTitle, requirementRefId };
      }),
    );

    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    enriched.sort((a, b) => {
      const pw = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
      if (pw !== 0) return pw;
      return a.title.localeCompare(b.title);
    });

    return enriched;
  },
});

export const listUnassignedByProgram = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const unassigned = tasks.filter((t) => !t.sprintId);

    const enriched = await Promise.all(
      unassigned.map(async (task) => {
        let requirementTitle: string | undefined;
        let requirementRefId: string | undefined;
        if (task.requirementId) {
          const req = await ctx.db.get(task.requirementId);
          if (req) {
            requirementTitle = req.title;
            requirementRefId = req.refId;
          }
        }
        let workstreamName: string | undefined;
        if (task.workstreamId) {
          const ws = await ctx.db.get(task.workstreamId);
          if (ws) workstreamName = ws.name;
        }
        return { ...task, requirementTitle, requirementRefId, workstreamName };
      }),
    );

    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    enriched.sort((a, b) => {
      const pw = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
      if (pw !== 0) return pw;
      return a.title.localeCompare(b.title);
    });

    return enriched;
  },
});

// ---------------------------------------------------------------------------
// Bulk assign tasks to a sprint
// ---------------------------------------------------------------------------

/**
 * Assign multiple tasks to a sprint in a single operation.
 * @param taskIds - Array of task IDs to assign
 * @param sprintId - Target sprint
 */
export const bulkAssignToSprint = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    if (args.taskIds.length === 0) return { updated: 0 };
    if (args.taskIds.length > 100) {
      throw new ConvexError("Cannot assign more than 100 tasks at once");
    }

    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) throw new ConvexError(`Task ${taskId} not found`);
      if (task.orgId !== sprint.orgId) {
        throw new ConvexError("Task does not belong to the same organization");
      }
      await ctx.db.patch(taskId, { sprintId: args.sprintId });
    }

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "update",
      description: `Assigned ${args.taskIds.length} tasks to sprint "${sprint.name}"`,
      metadata: { taskCount: args.taskIds.length },
    });

    return { updated: args.taskIds.length };
  },
});
