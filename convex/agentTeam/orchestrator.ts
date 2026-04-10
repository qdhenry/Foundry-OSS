import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { workflow } from "./workflowSetup";

export const sprintExecutionWorkflow = workflow.define({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    sprintWorkflowId: v.id("sprintWorkflows"),
    sprintId: v.id("sprintGates"),
  },
  handler: async (step, args): Promise<{ ok: true }> => {
    await step.runMutation(internal.agentTeam.workflows.updateStatusInternal, {
      sprintWorkflowId: args.sprintWorkflowId,
      status: "running",
    });

    await step.runMutation(internal.agentTeam.notifications.createInternal, {
      orgId: args.orgId,
      programId: args.programId,
      sprintWorkflowId: args.sprintWorkflowId,
      type: "completion",
      severity: "info",
      title: "Sprint workflow started",
      message: "Sprint orchestration has started.",
      channels: ["in_app"],
    });

    return { ok: true };
  },
});

export const startSprintExecution = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    sprintWorkflowId: v.id("sprintWorkflows"),
    sprintId: v.id("sprintGates"),
  },
  handler: async (ctx, args): Promise<{ workflowId: WorkflowId }> => {
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.agentTeam.orchestrator.sprintExecutionWorkflow,
      args,
    );

    await ctx.runMutation(internal.agentTeam.workflows.updateStatusInternal, {
      sprintWorkflowId: args.sprintWorkflowId,
      status: "pending",
      workflowId,
    });

    return { workflowId };
  },
});
