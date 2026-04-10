import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

/** List agent executions for a program with resolved skill names, newest first. */
export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .collect();

    // Resolve skill names
    const withSkillNames = await Promise.all(
      executions.map(async (exec) => {
        let skillName: string | null = null;
        if (exec.skillId) {
          const skill = await ctx.db.get(exec.skillId);
          skillName = skill?.name ?? null;
        }
        return { ...exec, skillName };
      }),
    );

    return withSkillNames;
  },
});

export const listByProgramWithContext = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      executions.map(async (exec) => {
        let skillName: string | null = null;
        if (exec.skillId) {
          const skill = await ctx.db.get(exec.skillId);
          skillName = skill?.name ?? null;
        }

        let requirementId: string | null = null;
        let requirementRefId: string | null = null;
        let requirementTitle: string | null = null;
        let taskTitle: string | null = null;
        let workstreamName: string | null = null;

        // Resolve task → requirement chain
        if (exec.taskId) {
          const task = await ctx.db.get(exec.taskId);
          if (task) {
            taskTitle = task.title;
            if (task.requirementId) {
              const req = await ctx.db.get(task.requirementId);
              if (req) {
                requirementId = req._id;
                requirementRefId = req.refId;
                requirementTitle = req.title;
              }
            }
          }
        }

        // Resolve workstream name
        if (exec.workstreamId) {
          const ws = await ctx.db.get(exec.workstreamId);
          workstreamName = ws?.name ?? null;
        }

        return {
          ...exec,
          skillName,
          requirementId,
          requirementRefId,
          requirementTitle,
          taskTitle,
          workstreamName,
        };
      }),
    );

    return enriched;
  },
});

/** Retrieve a single agent execution by ID. */
export const get = query({
  args: { executionId: v.id("agentExecutions") },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new ConvexError("Execution not found");
    await assertOrgAccess(ctx, execution.orgId);

    // Resolve skill name
    let skillName: string | null = null;
    if (execution.skillId) {
      const skill = await ctx.db.get(execution.skillId);
      skillName = skill?.name ?? null;
    }

    // Resolve user name
    let userName: string | null = null;
    if (execution.userId) {
      const user = await ctx.db.get(execution.userId);
      userName = user?.name ?? null;
    }

    return { ...execution, skillName, userName };
  },
});

/**
 * Retrieve detailed execution data including audit records, AI usage, subtasks,
 * pull requests, sandbox session, and logs.
 * @param executionId - The execution to inspect
 */
export const getDetail = query({
  args: { executionId: v.id("agentExecutions") },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new ConvexError("Execution not found");
    await assertOrgAccess(ctx, execution.orgId);

    // Resolve names (existing pattern)
    const [skill, user, task] = await Promise.all([
      execution.skillId ? ctx.db.get(execution.skillId) : null,
      execution.userId ? ctx.db.get(execution.userId) : null,
      execution.taskId ? ctx.db.get(execution.taskId) : null,
    ]);

    // Fetch related data in parallel
    const [auditRecords, usageRecords, subtasks, pullRequests] = await Promise.all([
      ctx.db
        .query("executionAuditRecords")
        .withIndex("by_agent_execution", (q) => q.eq("agentExecutionId", args.executionId))
        .order("desc")
        .collect(),
      ctx.db
        .query("aiUsageRecords")
        .withIndex("by_source_entity", (q) => q.eq("sourceEntityId", String(args.executionId)))
        .collect(),
      execution.taskId
        ? ctx.db
            .query("subtasks")
            .withIndex("by_task", (q) => q.eq("taskId", execution.taskId!))
            .collect()
        : [],
      execution.taskId
        ? ctx.db
            .query("sourceControlPullRequests")
            .withIndex("by_task", (q) => q.eq("taskId", execution.taskId!))
            .collect()
        : [],
    ]);

    // Get sandbox session if linked via audit records
    const sandboxSessionId = auditRecords.find((r) => r.sandboxSessionId)?.sandboxSessionId;
    const sandboxSession = sandboxSessionId ? await ctx.db.get(sandboxSessionId) : null;

    // Get last 50 sandbox logs if session exists
    const sandboxLogs = sandboxSessionId
      ? await ctx.db
          .query("sandboxLogs")
          .withIndex("by_session", (q) => q.eq("sessionId", sandboxSessionId))
          .order("desc")
          .take(50)
      : [];

    return {
      ...execution,
      skillName: skill?.name ?? null,
      userName: user?.name ?? null,
      taskTitle: task?.title ?? null,
      taskDescription: task?.description ?? null,
      auditRecords,
      costBreakdown:
        usageRecords.length > 0
          ? {
              inputTokens: usageRecords[0].inputTokens,
              outputTokens: usageRecords[0].outputTokens,
              cacheReadTokens: usageRecords[0].cacheReadTokens,
              cacheCreationTokens: usageRecords[0].cacheCreationTokens,
              costUsd: usageRecords[0].costUsd,
              modelId: usageRecords[0].claudeModelId,
            }
          : null,
      subtasks: subtasks.map((s) => ({
        _id: s._id,
        title: s.title,
        status: s.status,
        retryCount: s.retryCount,
        executionDurationMs: s.executionDurationMs,
        filesChanged: s.filesChanged,
        errorMessage: s.errorMessage,
        commitSha: s.commitSha,
      })),
      pullRequests: pullRequests.map((pr) => ({
        prNumber: pr.prNumber,
        title: pr.title,
        state: pr.state,
        reviewState: pr.reviewState,
        ciStatus: pr.ciStatus,
        additions: pr.additions,
        deletions: pr.deletions,
        providerUrl: pr.providerUrl,
      })),
      sandboxSession: sandboxSession
        ? {
            status: (sandboxSession as any).status,
            worktreeBranch: (sandboxSession as any).worktreeBranch,
            commitSha: (sandboxSession as any).commitSha,
            prUrl: (sandboxSession as any).prUrl,
            filesChanged: (sandboxSession as any).filesChanged,
          }
        : null,
      sandboxLogs: sandboxLogs.reverse().map((l) => ({
        level: l.level,
        message: l.message,
        timestamp: l.timestamp,
      })),
    };
  },
});

/** List the 10 most recent agent executions for a program. */
export const listRecent = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(10);

    // Resolve skill names
    const withSkillNames = await Promise.all(
      executions.map(async (exec) => {
        let skillName: string | null = null;
        if (exec.skillId) {
          const skill = await ctx.db.get(exec.skillId);
          skillName = skill?.name ?? null;
        }
        return { ...exec, skillName };
      }),
    );

    return withSkillNames;
  },
});

/** List all agent executions associated with a specific task. */
export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();

    const withSkillNames = await Promise.all(
      executions.map(async (exec) => {
        let skillName: string | null = null;
        if (exec.skillId) {
          const skill = await ctx.db.get(exec.skillId);
          skillName = skill?.name ?? null;
        }
        return { ...exec, skillName };
      }),
    );

    return withSkillNames;
  },
});

const REVIEW_EVENT_TYPE: Record<string, "review_accepted" | "review_rejected" | "review_revised"> =
  {
    accepted: "review_accepted",
    rejected: "review_rejected",
    revised: "review_revised",
  };

/**
 * Record a human review decision on an agent execution.
 * @param executionId - The execution to review
 * @param reviewStatus - Review outcome (accepted, revised, rejected)
 * @param reviewNotes - Optional reviewer notes
 */
export const updateReview = mutation({
  args: {
    executionId: v.id("agentExecutions"),
    reviewStatus: v.union(v.literal("accepted"), v.literal("revised"), v.literal("rejected")),
    reviewNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) throw new ConvexError("Execution not found");
    const user = await assertOrgAccess(ctx, execution.orgId);

    await ctx.db.patch(args.executionId, {
      reviewStatus: args.reviewStatus,
    });

    // Write audit record if this execution is linked to a task
    if (execution.taskId) {
      const task = await ctx.db.get(execution.taskId);
      let skillName: string | undefined;
      if (execution.skillId) {
        const skill = await ctx.db.get(execution.skillId);
        skillName = skill?.name ?? undefined;
      }

      try {
        await ctx.db.insert("executionAuditRecords", {
          orgId: execution.orgId,
          programId: execution.programId,
          taskId: execution.taskId,
          agentExecutionId: args.executionId,
          eventType: REVIEW_EVENT_TYPE[args.reviewStatus],
          initiatedBy: user._id,
          initiatedByName: user.name ?? "Unknown",
          initiatedByClerkId: user.clerkId ?? "",
          timestamp: Date.now(),
          taskTitle: task?.title ?? "Unknown task",
          skillId: execution.skillId,
          skillName,
          workstreamId: execution.workstreamId,
          environment: {
            executionMode: execution.executionMode,
          },
          outcome: {
            status: args.reviewStatus,
            tokensUsed: execution.tokensUsed,
            durationMs: execution.durationMs,
          },
          reviewStatus: args.reviewStatus,
          reviewedBy: user._id,
          reviewedAt: Date.now(),
          reviewNotes: args.reviewNotes,
        });
      } catch {
        // Best effort — audit failures must not break the review flow
      }
    }
  },
});
