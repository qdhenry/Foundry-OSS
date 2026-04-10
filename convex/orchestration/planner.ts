"use node";

import { ConvexError, v } from "convex/values";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api, internal } = require("../_generated/api") as { api: any; internal: any };

import { action } from "../_generated/server";
import { callAgentService } from "../lib/agentServiceClient";

// ── Types ───────────────────────────────────────────────────────────────────

interface TaskAssignment {
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  executionMode: string;
  repositoryId?: string;
  branchName: string;
  estimatedTokens: number;
  confidence?: number;
  rationale?: string;
}

interface Wave {
  waveNumber: number;
  taskAssignments: TaskAssignment[];
}

interface ExecutionPlan {
  waves: Wave[];
  estimatedTotalTokens: number;
  estimatedTotalCost: number;
}

interface PlanAssignmentResponse {
  assignments: Array<{
    taskId: string;
    agentId: string;
    executionMode: string;
    confidence: number;
    branchName: string;
    estimatedTokens: number;
    rationale: string;
    repositoryId?: string;
  }>;
}

interface EnrichedAssignment {
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  executionMode: string;
  confidence?: number;
  branchName: string;
  estimatedTokens: number;
  rationale?: string;
  repositoryId?: string;
}

// ── Wave Computation Helper ─────────────────────────────────────────────────

function computeWaves(
  tasks: Array<{ _id: string; blockedBy?: string[] }>,
  assignments: EnrichedAssignment[],
): Wave[] {
  const taskIdsInRun = new Set(tasks.map((t) => t._id));
  const assignmentMap = new Map(assignments.map((a) => [a.taskId, a]));

  // Build effective blockers: only blockers that are also in this run
  const effectiveBlockers = new Map<string, Set<string>>();
  for (const task of tasks) {
    const blockers = new Set<string>();
    if (task.blockedBy) {
      for (const blockerId of task.blockedBy) {
        if (taskIdsInRun.has(blockerId)) {
          blockers.add(blockerId);
        }
      }
    }
    effectiveBlockers.set(task._id, blockers);
  }

  const waves: Wave[] = [];
  const assigned = new Set<string>();
  const remaining = new Set(taskIdsInRun);

  while (remaining.size > 0) {
    const currentWave: TaskAssignment[] = [];

    const readyThisWave: string[] = [];

    for (const taskId of Array.from(remaining)) {
      const blockers = effectiveBlockers.get(taskId)!;
      const unresolvedBlockers = Array.from(blockers).filter((b) => !assigned.has(b));
      if (unresolvedBlockers.length === 0) {
        readyThisWave.push(taskId);
        const assignment = assignmentMap.get(taskId);
        if (assignment) {
          currentWave.push({
            taskId: assignment.taskId,
            taskTitle: assignment.taskTitle,
            agentId: assignment.agentId,
            agentName: assignment.agentName,
            executionMode: assignment.executionMode,
            repositoryId: assignment.repositoryId,
            branchName: assignment.branchName,
            estimatedTokens: assignment.estimatedTokens,
            confidence: assignment.confidence,
            rationale: assignment.rationale,
          });
        }
      }
    }

    // If no tasks are ready (true circular dependency), break out
    if (readyThisWave.length === 0) {
      // Skip remaining tasks rather than crashing — they have unresolvable deps
      break;
    }

    // Even if currentWave has no assignments (tasks ready but unassigned by AI),
    // we still need to mark them as assigned to unblock downstream tasks
    for (const taskId of readyThisWave) {
      assigned.add(taskId);
      remaining.delete(taskId);
    }

    // Only add a wave if it has actual task assignments
    if (currentWave.length > 0) {
      waves.push({
        waveNumber: waves.length + 1,
        taskAssignments: currentWave,
      });
    }
  }

  return waves;
}

// ── Cost Estimation Rates ───────────────────────────────────────────────────

const MODEL_RATES: Record<string, { avgPerMillionTokens: number }> = {
  "claude-opus-4-6": { avgPerMillionTokens: 45 },
  "claude-sonnet-4-5-20250929": { avgPerMillionTokens: 9 },
  "claude-sonnet-4-5-20250514": { avgPerMillionTokens: 9 },
};

const DEFAULT_RATE = { avgPerMillionTokens: 9 };

// ── Actions ─────────────────────────────────────────────────────────────────

/**
 * Generate an AI-powered execution plan for an orchestration run. Analyzes
 * tasks, skills, and repository context to produce an optimal execution sequence.
 * @param orgId - Organization ID
 * @param programId - Target program
 * @param runId - The orchestration run to plan
 */
export const generatePlan = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
  },
  handler: async (ctx, args): Promise<ExecutionPlan> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Cast runQuery to break circular type instantiation (TS2589)
    const runQ = ctx.runQuery as any;
    const runM = ctx.runMutation as any;

    // 1. Fetch the run
    const run: any = await runQ(api.orchestration.runs.get, {
      runId: args.runId,
    });

    // 2. Load tasks based on scope type
    let tasks: any[] = [];
    if (run.scopeType === "sprint" && run.sprintId) {
      const allTasks: any[] = await runQ(api.tasks.listByProgram, {
        programId: args.programId,
      });
      tasks = allTasks.filter((t: any) => t.sprintId === run.sprintId && t.status !== "done");
    } else if (run.scopeType === "workstream" && run.workstreamId) {
      const allTasks: any[] = await runQ(api.tasks.listByProgram, {
        programId: args.programId,
      });
      tasks = allTasks.filter(
        (t: any) => t.workstreamId === run.workstreamId && t.status !== "done",
      );
    } else if (run.scopeType === "custom" && run.taskIds) {
      const allTasks: any[] = await runQ(api.tasks.listByProgram, {
        programId: args.programId,
      });
      const taskIdSet = new Set(run.taskIds);
      tasks = allTasks.filter((t: any) => taskIdSet.has(t._id));
    }

    const scopeLabel = run.scopeType === "custom" ? "custom selection" : `${run.scopeType} scope`;

    await emitPlanningEvent(
      "planning_progress",
      `Loaded ${tasks.length} tasks from ${scopeLabel}`,
      {
        scopeType: run.scopeType,
        stage: "tasks_loaded",
        taskCount: tasks.length,
      },
    );

    if (tasks.length === 0) {
      throw new Error("No tasks found for the given scope");
    }

    // 3. Fetch available agents
    const allAgents: any[] = await runQ(api.agentTeam.agents.listByProgram, {
      programId: args.programId,
    });
    const availableAgents = allAgents.filter(
      (a: any) => a.status === "idle" || a.status === "active",
    );

    if (availableAgents.length === 0) {
      throw new Error("No available agents found for this program");
    }

    // 4. Call agent service for AI-powered assignment
    const response = await callAgentService<PlanAssignmentResponse>({
      endpoint: "/plan-assignments",
      orgId: args.orgId,
      body: {
        tasks: tasks.map((t: any) => ({
          id: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          workstreamId: t.workstreamId,
          blockedBy: t.blockedBy ?? [],
          requirementId: t.requirementId,
          tags: t.tags ?? [],
        })),
        agents: availableAgents.map((a: any) => ({
          id: a._id,
          name: a.name,
          role: a.role,
          model: a.model,
          specializations: a.specializations ?? [],
          status: a.status,
        })),
        repositories: run.repositoryIds,
        branchStrategy: run.branchStrategy,
        branchPattern: run.branchPattern,
      },
      timeoutMs: 120_000,
    });

    // 5. Enrich assignments with resolved task titles and agent names
    const taskMap = new Map(tasks.map((t: any) => [t._id, t.title as string]));
    const agentMap = new Map(availableAgents.map((a: any) => [a._id, a.name as string]));

    const enrichedAssignments: EnrichedAssignment[] = response.assignments.map((a) => ({
      ...a,
      taskTitle: taskMap.get(a.taskId) ?? "Unknown Task",
      agentName: agentMap.get(a.agentId) ?? "Unknown Agent",
    }));

    // 6. Compute waves from dependency graph
    const waves = computeWaves(
      tasks.map((t: any) => ({
        _id: t._id,
        blockedBy: t.blockedBy,
      })),
      enrichedAssignments,
    );

    // 7. Calculate totals
    const estimatedTotalTokens = response.assignments.reduce(
      (sum, a) => sum + a.estimatedTokens,
      0,
    );

    // Calculate cost based on agent models
    const agentModelMap = new Map(availableAgents.map((a: any) => [a._id, a.model]));
    let estimatedTotalCost = 0;
    for (const assignment of response.assignments) {
      const model = agentModelMap.get(assignment.agentId) ?? "claude-sonnet-4-5-20250929";
      const rate = MODEL_RATES[model] ?? DEFAULT_RATE;
      estimatedTotalCost += (assignment.estimatedTokens / 1_000_000) * rate.avgPerMillionTokens;
    }

    // 8. Assemble execution plan
    const executionPlan: ExecutionPlan = {
      waves,
      estimatedTotalTokens,
      estimatedTotalCost: Math.round(estimatedTotalCost * 100) / 100,
    };

    // 9. Save plan to the run
    await runM(api.orchestration.runs.updateExecutionPlan, {
      runId: args.runId,
      executionPlan,
    });

    // 10. Best-effort notification
    try {
      await ctx.runMutation(internal.notifications.create, {
        orgId: run.orgId,
        userId: run.startedBy,
        programId: args.programId,
        type: "orchestration_plan_ready" as const,
        title: "Orchestration plan ready",
        body: `Plan for "${run.name}" is ready for review.`,
        link: `/${args.programId}/orchestration/${args.runId}`,
        entityType: "orchestrationRun",
        entityId: args.runId,
      });
    } catch {
      // Best-effort — do not fail the plan generation
    }

    return executionPlan;
  },
});

/** Estimate the token and dollar cost for an orchestration plan before execution. */
export const estimateCost = action({
  args: {
    assignments: v.array(
      v.object({
        model: v.string(),
        estimatedTokens: v.number(),
        agentId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{
    perAgent: Array<{ agentId?: string; model: string; tokens: number; cost: number }>;
    total: { tokens: number; cost: number };
  }> => {
    let totalTokens = 0;
    let totalCost = 0;

    const perAgent = args.assignments.map((a) => {
      const rate = MODEL_RATES[a.model] ?? DEFAULT_RATE;
      const cost = (a.estimatedTokens / 1_000_000) * rate.avgPerMillionTokens;
      totalTokens += a.estimatedTokens;
      totalCost += cost;

      return {
        agentId: a.agentId,
        model: a.model,
        tokens: a.estimatedTokens,
        cost: Math.round(cost * 100) / 100,
      };
    });

    return {
      perAgent,
      total: {
        tokens: totalTokens,
        cost: Math.round(totalCost * 100) / 100,
      },
    };
  },
});
