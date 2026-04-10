import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";

// ---------------------------------------------------------------------------
// linkRepoToTask — add a sourceControlRepositories ID to a task's repositoryIds
// ---------------------------------------------------------------------------

export const linkRepoToTask = mutation({
  args: {
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    if (repo.orgId !== task.orgId)
      throw new Error("Repository does not belong to this organization");
    if (repo.programId !== task.programId)
      throw new Error("Repository does not belong to the same program");

    const existing = task.repositoryIds ?? [];
    if (existing.includes(args.repositoryId)) {
      // Already linked — silently return
      return;
    }

    const updated = [...existing, args.repositoryId];
    await ctx.db.patch(args.taskId, { repositoryIds: updated });

    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId,
      entityType: "task",
      entityId: args.taskId,
      action: "update",
      description: `Linked repository ${repo.repoFullName} to task "${task.title}"`,
      metadata: { repositoryId: args.repositoryId, repoFullName: repo.repoFullName },
    });
  },
});

// ---------------------------------------------------------------------------
// unlinkRepoFromTask — remove a repo from a task's repositoryIds
// ---------------------------------------------------------------------------

export const unlinkRepoFromTask = mutation({
  args: {
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const existing = task.repositoryIds ?? [];
    if (!existing.includes(args.repositoryId)) {
      // Not linked — silently return
      return;
    }

    const updated = existing.filter((id) => id !== args.repositoryId);

    await ctx.db.patch(args.taskId, {
      repositoryIds: updated.length > 0 ? updated : undefined,
    });

    const repo = await ctx.db.get(args.repositoryId);
    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId,
      entityType: "task",
      entityId: args.taskId,
      action: "update",
      description: `Unlinked repository ${repo?.repoFullName ?? args.repositoryId} from task "${task.title}"`,
      metadata: { repositoryId: args.repositoryId },
    });
  },
});

// ---------------------------------------------------------------------------
// linkRepoToWorkstream — add a repo to a workstream's repositoryIds
// ---------------------------------------------------------------------------

export const linkRepoToWorkstream = mutation({
  args: {
    workstreamId: v.id("workstreams"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new Error("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    if (repo.orgId !== workstream.orgId)
      throw new Error("Repository does not belong to this organization");
    if (repo.programId !== workstream.programId)
      throw new Error("Repository does not belong to the same program");

    const existing = workstream.repositoryIds ?? [];
    if (existing.includes(args.repositoryId)) {
      // Already linked — silently return
      return;
    }

    const updated = [...existing, args.repositoryId];
    await ctx.db.patch(args.workstreamId, { repositoryIds: updated });

    await logAuditEvent(ctx, {
      orgId: workstream.orgId,
      programId: workstream.programId,
      entityType: "workstream",
      entityId: args.workstreamId,
      action: "update",
      description: `Linked repository ${repo.repoFullName} to workstream "${workstream.name}"`,
      metadata: { repositoryId: args.repositoryId, repoFullName: repo.repoFullName },
    });
  },
});

// ---------------------------------------------------------------------------
// unlinkRepoFromWorkstream — remove a repo from a workstream's repositoryIds
// ---------------------------------------------------------------------------

export const unlinkRepoFromWorkstream = mutation({
  args: {
    workstreamId: v.id("workstreams"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new Error("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    const existing = workstream.repositoryIds ?? [];
    if (!existing.includes(args.repositoryId)) {
      // Not linked — silently return
      return;
    }

    const updated = existing.filter((id) => id !== args.repositoryId);

    await ctx.db.patch(args.workstreamId, {
      repositoryIds: updated.length > 0 ? updated : undefined,
    });

    const repo = await ctx.db.get(args.repositoryId);
    await logAuditEvent(ctx, {
      orgId: workstream.orgId,
      programId: workstream.programId,
      entityType: "workstream",
      entityId: args.workstreamId,
      action: "update",
      description: `Unlinked repository ${repo?.repoFullName ?? args.repositoryId} from workstream "${workstream.name}"`,
      metadata: { repositoryId: args.repositoryId },
    });
  },
});

// ---------------------------------------------------------------------------
// listTasksByRepo — find all tasks in a program linked to a specific repo
// ---------------------------------------------------------------------------

export const listTasksByRepo = query({
  args: {
    programId: v.id("programs"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return allTasks.filter((task) => task.repositoryIds?.includes(args.repositoryId) ?? false);
  },
});

// ---------------------------------------------------------------------------
// listWorkstreamsByRepo — find all workstreams in a program linked to a specific repo
// ---------------------------------------------------------------------------

export const listWorkstreamsByRepo = query({
  args: {
    programId: v.id("programs"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const allWorkstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return allWorkstreams.filter((ws) => ws.repositoryIds?.includes(args.repositoryId) ?? false);
  },
});
