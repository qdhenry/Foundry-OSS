import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflow } from "../agentTeam/workflowSetup";

// ── Types ───────────────────────────────────────────────────────────────────

interface TaskAssignment {
  taskId: string;
  agentId: string;
  executionMode: string;
  repositoryId?: string;
  branchName: string;
  estimatedTokens: number;
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

// ── Orchestration Workflow (must be in non-Node file) ─────────────────────

export const orchestrationWorkflow = workflow.define({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
  },
  handler: async (step, args): Promise<{ ok: true }> => {
    // 1. Set status to running
    await step.runMutation(internal.orchestration.runs.updateStatusInternal, {
      runId: args.runId,
      status: "running",
    });

    // 2. Log start event
    await step.runMutation(internal.orchestration.events.createInternal, {
      orgId: args.orgId,
      runId: args.runId,
      type: "run_started",
      message: "Orchestration started",
    });

    // 3. Fetch the run to get execution plan
    const run = await step.runQuery(internal.orchestration.runs.getInternal, {
      runId: args.runId,
    });

    if (!run) {
      throw new Error("Orchestration run not found");
    }

    const executionPlan = run.executionPlan as ExecutionPlan | undefined;
    if (!executionPlan?.waves) {
      throw new Error("No execution plan found on orchestration run");
    }

    // 4. Iterate waves
    try {
      for (const wave of executionPlan.waves) {
        // Log wave start
        await step.runMutation(internal.orchestration.events.createInternal, {
          orgId: args.orgId,
          runId: args.runId,
          type: "wave_started",
          message: `Wave ${wave.waveNumber} started with ${wave.taskAssignments.length} tasks`,
          metadata: {
            waveNumber: wave.waveNumber,
            taskCount: wave.taskAssignments.length,
          },
        });

        // Dispatch tasks in this wave using batched parallelism.
        // Waves represent parallel-safe tasks, so we dispatch them concurrently
        // in batches bounded by maxConcurrency from the run configuration.
        const maxConcurrency = run.maxConcurrency ?? 3;
        const assignments = wave.taskAssignments;

        for (let batchStart = 0; batchStart < assignments.length; batchStart += maxConcurrency) {
          // Check if run is still active before dispatching next batch
          const currentRun = await step.runQuery(internal.orchestration.runs.getInternal, {
            runId: args.runId,
          });

          if (currentRun?.status === "cancelled") {
            await step.runMutation(internal.orchestration.events.createInternal, {
              orgId: args.orgId,
              runId: args.runId,
              type: "run_cancelled",
              message: "Orchestration cancelled mid-execution",
            });
            return { ok: true };
          }

          if (currentRun?.status === "paused") {
            await step.runMutation(internal.orchestration.events.createInternal, {
              orgId: args.orgId,
              runId: args.runId,
              type: "run_paused",
              message: `Orchestration paused during wave ${wave.waveNumber}`,
            });
            return { ok: true };
          }

          // Slice out the current batch and dispatch all tasks in parallel
          const batch = assignments.slice(batchStart, batchStart + maxConcurrency);

          await Promise.all(
            batch.map((assignment) =>
              step.runAction(internal.orchestration.executor.dispatchOrchestrationTask, {
                orgId: args.orgId,
                programId: args.programId,
                runId: args.runId,
                taskId: assignment.taskId,
                agentId: assignment.agentId,
                executionMode: assignment.executionMode,
                repositoryId: assignment.repositoryId,
                branchName: assignment.branchName,
              }),
            ),
          );
        }
      }

      // 5. All waves complete — set status and generate report
      await step.runMutation(internal.orchestration.runs.updateStatusInternal, {
        runId: args.runId,
        status: "completed",
      });

      await step.runAction(internal.orchestration.executor.generateReportInternal, {
        orgId: args.orgId,
        programId: args.programId,
        runId: args.runId,
      });

      // Best-effort completion notification
      try {
        await step.runMutation(internal.notifications.create, {
          orgId: args.orgId,
          userId: run.startedBy,
          programId: args.programId,
          type: "orchestration_complete",
          title: "Orchestration complete",
          body: `Run "${run.name}" has completed successfully.`,
          link: `/${args.programId}/orchestration/${args.runId}`,
          entityType: "orchestrationRun",
          entityId: args.runId,
        });
      } catch {
        // Best-effort — do not fail the workflow
      }
    } catch (error) {
      // Attempt to mark the run as failed
      try {
        await step.runMutation(internal.orchestration.runs.updateStatusInternal, {
          runId: args.runId,
          status: "failed",
        });
      } catch {
        // If status update fails, still try to notify
      }

      // Best-effort failure notification
      try {
        await step.runMutation(internal.notifications.create, {
          orgId: args.orgId,
          userId: run.startedBy,
          programId: args.programId,
          type: "orchestration_failed",
          title: "Orchestration failed",
          body: `Run "${run.name}" has failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          link: `/${args.programId}/orchestration/${args.runId}`,
          entityType: "orchestrationRun",
          entityId: args.runId,
        });
      } catch {
        // Best-effort — do not mask the original error
      }

      throw error;
    }

    return { ok: true };
  },
});
