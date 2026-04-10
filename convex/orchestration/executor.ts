"use node";

import type { WorkflowId } from "@convex-dev/workflow";
import { ConvexError, v } from "convex/values";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api, internal } = require("../_generated/api") as { api: any; internal: any };

import { action, internalAction } from "../_generated/server";
import { workflow } from "../agentTeam/workflowSetup";
import { callAgentService } from "../lib/agentServiceClient";

// ── Types ───────────────────────────────────────────────────────────────────

interface ExecutionPlan {
  waves: Array<{ waveNumber: number; taskAssignments: Array<{ estimatedTokens: number }> }>;
  estimatedTotalTokens: number;
  estimatedTotalCost: number;
}

// ── Dispatch Orchestration Task ────────────────────────────────────────────

export const dispatchOrchestrationTask = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
    taskId: v.string(),
    agentId: v.string(),
    executionMode: v.string(),
    repositoryId: v.optional(v.string()),
    branchName: v.string(),
  },
  handler: async (ctx, args) => {
    const runQ = ctx.runQuery as any;
    const runM = ctx.runMutation as any;

    // 1. Fetch agent and version (use internal queries — no auth in workflow context)
    const agent = await runQ(internal.agentTeam.agents.getInternal, { agentId: args.agentId });
    if (!agent) {
      throw new Error(`Agent ${args.agentId} not found`);
    }

    const currentVersion = await runQ(internal.agentTeam.versions.getVersionInternal, {
      agentId: args.agentId,
      version: agent.currentVersion,
    });
    if (!currentVersion) {
      throw new Error(`Agent version not found for agent ${args.agentId}`);
    }

    // 2. Set agent status to executing
    await runM(internal.agentTeam.agents.updateStatusInternal, {
      agentId: args.agentId,
      status: "executing",
    });

    // 3. Create execution record
    const executionId: string = await runM(internal.agentTeam.executions.createInternal, {
      orgId: args.orgId,
      programId: args.programId,
      agentId: args.agentId,
      agentVersionId: currentVersion._id,
      orchestrationRunId: args.runId,
      taskId: args.taskId,
      executionMode: args.executionMode === "sandbox" ? "sandbox" : "sdk",
      inputSummary: `Orchestration task: ${args.branchName}`,
    });

    // 4. Log dispatch event
    await runM(internal.orchestration.events.createInternal, {
      orgId: args.orgId,
      runId: args.runId,
      type: "task_dispatched",
      agentId: args.agentId,
      taskId: args.taskId,
      message: `Dispatched task to agent "${agent.name}" via ${args.executionMode} mode on branch ${args.branchName}`,
      metadata: {
        executionId,
        executionMode: args.executionMode,
        branchName: args.branchName,
        repositoryId: args.repositoryId,
      },
    });

    // 5. Update execution to running
    await runM(internal.agentTeam.executions.updateStatusInternal, {
      executionId,
      status: "running",
    });

    const startTime = Date.now();

    try {
      // 6. Call agent service to dispatch
      // Both SDK and sandbox modes use /dispatch-agent for v1
      // Sandbox provisioning will be wired in a future iteration
      const response = await callAgentService<{
        result: {
          summary: string;
          findings: string[];
          artifacts: Array<{ type: string; title: string; content: string }>;
          nextActions: string[];
        };
        metadata: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokensUsed?: number;
        };
      }>({
        endpoint: "/dispatch-agent",
        orgId: args.orgId,
        body: {
          agent: {
            name: agent.name,
            role: agent.role,
            model: agent.model,
            tools: agent.tools,
            systemPrompt: agent.systemPrompt,
            constraints: agent.constraints,
            specializations: agent.specializations,
          },
          task: {
            title: `Orchestration task`,
            description: `Execute task on branch ${args.branchName}`,
            taskId: args.taskId,
          },
          context: {
            programId: args.programId,
            orchestrationRunId: args.runId,
            branchName: args.branchName,
            repositoryId: args.repositoryId,
            executionMode: args.executionMode,
          },
        },
        timeoutMs: 180_000,
      });

      const durationMs = Date.now() - startTime;
      const inputTokens = response.metadata?.inputTokens ?? 0;
      const outputTokens = response.metadata?.outputTokens ?? 0;
      const totalTokens = response.metadata?.totalTokensUsed ?? inputTokens + outputTokens;
      const cost = totalTokens * 0.000003;

      // 7. Update execution to success
      await runM(internal.agentTeam.executions.updateStatusInternal, {
        executionId,
        status: "success",
        outputSummary: response.result.summary,
        tokensUsed: { input: inputTokens, output: outputTokens, total: totalTokens },
        durationMs,
        cost,
      });

      // 8. Set agent back to idle
      await runM(internal.agentTeam.agents.updateStatusInternal, {
        agentId: args.agentId,
        status: "idle",
      });

      // 9. Update run usage totals (atomic increment — safe for concurrent tasks)
      await runM(internal.orchestration.runs.incrementUsageInternal, {
        runId: args.runId,
        tokensDelta: totalTokens,
        costDelta: cost,
      });

      // 10. Update org budget usage (best-effort, public mutation OK from action context)
      try {
        await runM(api.agentTeam.budgets.addExecutionUsage, {
          orgId: args.orgId,
          tokensUsed: totalTokens,
        });
      } catch {
        // Budget tracking is best-effort
      }

      // 11. Log completion event
      await runM(internal.orchestration.events.createInternal, {
        orgId: args.orgId,
        runId: args.runId,
        type: "task_completed",
        agentId: args.agentId,
        taskId: args.taskId,
        message: `Task completed by agent "${agent.name}" in ${durationMs}ms (${totalTokens} tokens)`,
        metadata: {
          executionId,
          durationMs,
          tokensUsed: totalTokens,
          cost,
        },
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error?.message ?? "Unknown error";

      // Update execution to failed
      await runM(internal.agentTeam.executions.updateStatusInternal, {
        executionId,
        status: "failed",
        errorDetails: errorMessage,
        durationMs,
      });

      // Set agent to error state
      await runM(internal.agentTeam.agents.updateStatusInternal, {
        agentId: args.agentId,
        status: "error",
      });

      // Log failure event
      await runM(internal.orchestration.events.createInternal, {
        orgId: args.orgId,
        runId: args.runId,
        type: "task_failed",
        agentId: args.agentId,
        taskId: args.taskId,
        message: `Task failed for agent "${agent.name}": ${errorMessage}`,
        metadata: {
          executionId,
          durationMs,
          error: errorMessage,
        },
      });

      // Don't rethrow — allow the workflow to continue with other tasks
      // The failure is tracked via the execution record and event log
    }
  },
});

// ── Generate Report (internal, for workflow use) ───────────────────────────

export const generateReportInternal = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
  },
  handler: async (ctx, args) => {
    const runQ = ctx.runQuery as any;
    const runM = ctx.runMutation as any;

    // Fetch executions for this program, then filter by orchestrationRunId
    const executions: any[] = await runQ(
      internal.agentTeam.executions.listByOrchestrationRunInternal,
      { orchestrationRunId: args.runId },
    );

    // Group executions by agentId and compute per-agent stats
    const agentMap = new Map<string, { executions: any[]; name: string }>();
    for (const exec of executions) {
      const agentId = exec.agentId as string;
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { executions: [], name: agentId });
      }
      agentMap.get(agentId)!.executions.push(exec);
    }

    // Resolve agent names
    for (const [agentId, data] of agentMap) {
      try {
        const agent = await runQ(internal.agentTeam.agents.getInternal, { agentId });
        if (agent?.name) {
          data.name = agent.name;
        }
      } catch {
        // Keep ID as name
      }
    }

    const perAgent: Array<{
      agentId: string;
      agentName: string;
      tasksAttempted: number;
      tasksSucceeded: number;
      tasksFailed: number;
      tokensUsed: number;
      cost: number;
      durationMs: number;
    }> = [];
    const riskNotes: Array<{ taskName: string; agentId: string; error: string }> = [];
    let totalDurationMs = 0;
    let totalTokensUsed = 0;
    let totalCost = 0;

    for (const [agentId, data] of agentMap) {
      const agentExecs = data.executions;
      const succeeded = agentExecs.filter((e: any) => e.status === "success");
      const failed = agentExecs.filter((e: any) => e.status === "failed");

      const agentTokens = agentExecs.reduce(
        (sum: number, e: any) => sum + (e.tokensUsed?.total ?? 0),
        0,
      );
      const agentCost = agentExecs.reduce((sum: number, e: any) => sum + (e.cost ?? 0), 0);
      const agentDuration = agentExecs.reduce(
        (sum: number, e: any) => sum + (e.durationMs ?? 0),
        0,
      );

      perAgent.push({
        agentId,
        agentName: data.name,
        tasksAttempted: agentExecs.length,
        tasksSucceeded: succeeded.length,
        tasksFailed: failed.length,
        tokensUsed: agentTokens,
        cost: agentCost,
        durationMs: agentDuration,
      });

      totalTokensUsed += agentTokens;
      totalCost += agentCost;
      totalDurationMs += agentDuration;

      for (const exec of failed) {
        riskNotes.push({
          taskName: exec.inputSummary ?? "Unknown task",
          agentId,
          error: exec.errorDetails ?? "No error details available",
        });
      }
    }

    const report = {
      perAgent,
      prUrls: [],
      branches: [],
      totalDurationMs,
      totalTokensUsed,
      totalCost,
      riskNotes,
      generatedAt: Date.now(),
    };

    // Persist report
    await runM(internal.orchestration.runs.setReport, {
      runId: args.runId,
      report,
    });

    // Log completion event
    await runM(internal.orchestration.events.createInternal, {
      orgId: args.orgId,
      runId: args.runId,
      type: "run_completed",
      message: `Run report generated: ${perAgent.length} agents, ${executions.length} tasks, ${riskNotes.length} failures`,
      metadata: {
        totalTokensUsed,
        totalCost,
        totalDurationMs,
        agentCount: perAgent.length,
        taskCount: executions.length,
        failureCount: riskNotes.length,
      },
    });

    // Create notification
    await runM(internal.agentTeam.notifications.createInternal, {
      orgId: args.orgId,
      programId: args.programId,
      type: "sprint_complete",
      severity: riskNotes.length > 0 ? "warning" : "info",
      title: "Orchestration run completed",
      message: `${executions.length} tasks executed across ${perAgent.length} agents. ${riskNotes.length} failures.`,
      channels: ["in_app"],
    });

    // Attempt PR creation (best-effort)
    try {
      await (ctx.runAction as any)(internal.orchestration.reporter.createPRs, {
        orgId: args.orgId,
        programId: args.programId,
        runId: args.runId,
      });
    } catch {
      // PR creation is best-effort — log but don't fail
      await runM(internal.orchestration.events.createInternal, {
        orgId: args.orgId,
        runId: args.runId,
        type: "pr_created",
        message: "PR creation skipped: unable to create PRs from workflow context",
      });
    }
  },
});

// ── Start Orchestration (public action) ────────────────────────────────────

export const startOrchestration = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const runQ = ctx.runQuery as any;
    const runM = ctx.runMutation as any;

    // 1. Fetch run and verify it's in previewing status
    const run = await runQ(api.orchestration.runs.get, { runId: args.runId });
    if (!run) throw new ConvexError("Orchestration run not found");
    if (run.orgId !== args.orgId) throw new ConvexError("Access denied");
    if (run.status !== "previewing") {
      throw new ConvexError(
        `Cannot start orchestration: run is in "${run.status}" status, expected "previewing"`,
      );
    }
    if (!run.executionPlan) {
      throw new ConvexError("Cannot start orchestration: no execution plan generated");
    }

    // 2. Check org budget
    try {
      const budgetInfo = await runQ(api.agentTeam.budgets.get, { orgId: args.orgId });
      if (budgetInfo) {
        const remaining =
          (budgetInfo.monthlyTokenBudget ?? 0) - (budgetInfo.monthlyTokensUsed ?? 0);
        const estimatedTokens = (run.executionPlan as ExecutionPlan).estimatedTotalTokens ?? 0;
        if (remaining > 0 && estimatedTokens > remaining) {
          throw new ConvexError(
            `Estimated token usage (${estimatedTokens}) exceeds remaining budget (${remaining}). Increase budget or reduce scope.`,
          );
        }
      }
    } catch (error) {
      // Budget check is advisory — if the query doesn't exist yet, continue
      if (error instanceof ConvexError) throw error;
    }

    // 3. Start workflow (definition lives in orchestration/workflow.ts, non-Node file)
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.orchestration.workflow.orchestrationWorkflow,
      {
        orgId: args.orgId,
        programId: args.programId,
        runId: args.runId,
      },
    );

    // 4. Save workflowId on the run
    await runM(internal.orchestration.runs.setWorkflowId, {
      runId: args.runId,
      workflowId: workflowId as string,
    });

    return { workflowId: workflowId as string };
  },
});
