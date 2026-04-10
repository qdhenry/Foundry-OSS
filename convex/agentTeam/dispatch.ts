"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { callAgentService } from "../lib/agentServiceClient";

export const dispatchAgent = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    agentId: v.id("programAgents"),
    taskTitle: v.string(),
    taskDescription: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    executionId: Id<"agentTaskExecutions">;
    result: {
      summary: string;
      findings: string[];
      artifacts: Array<{ type: string; title: string; content: string }>;
      nextActions: string[];
    };
    durationMs: number;
    tokensUsed: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // @ts-expect-error Convex type depth limit with 81-table schema
    const agent = await ctx.runQuery(api.agentTeam.agents.get, {
      agentId: args.agentId,
    });
    if (!agent) throw new Error("Agent not found");
    if (agent.orgId !== args.orgId) throw new ConvexError("Access denied");

    const currentVersion = await ctx.runQuery(api.agentTeam.versions.getVersion, {
      agentId: args.agentId,
      version: agent.currentVersion,
    });
    if (!currentVersion) throw new Error("Agent version not found");

    await ctx.runMutation(api.agentTeam.agents.updateStatus, {
      agentId: args.agentId,
      status: "executing",
    });

    const executionId = await ctx.runMutation(api.agentTeam.executions.create, {
      orgId: args.orgId,
      programId: args.programId,
      agentId: args.agentId,
      agentVersionId: currentVersion._id,
      taskId: args.taskId,
      executionMode: "sdk",
      inputSummary: args.taskTitle,
    });

    await ctx.runMutation(api.agentTeam.executions.updateStatus, {
      executionId,
      status: "running",
    });

    const startTime = Date.now();

    try {
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
            title: args.taskTitle,
            description: args.taskDescription ?? "",
          },
          context: {
            programId: args.programId,
          },
        },
        timeoutMs: 180_000,
      });

      const durationMs = Date.now() - startTime;
      const inputTokens = response.metadata?.inputTokens ?? 0;
      const outputTokens = response.metadata?.outputTokens ?? 0;
      const totalTokens = response.metadata?.totalTokensUsed ?? inputTokens + outputTokens;
      const cost = totalTokens * 0.000003;

      await ctx.runMutation(api.agentTeam.executions.updateStatus, {
        executionId,
        status: "success",
        outputSummary: response.result.summary,
        tokensUsed: { input: inputTokens, output: outputTokens, total: totalTokens },
        durationMs,
        cost,
      });

      await ctx.runMutation(api.agentTeam.agents.updateStatus, {
        agentId: args.agentId,
        status: "idle",
      });

      await ctx.runMutation(api.agentTeam.budgets.addExecutionUsage, {
        orgId: args.orgId,
        tokensUsed: totalTokens,
      });

      return {
        executionId,
        result: response.result,
        durationMs,
        tokensUsed: totalTokens,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      await ctx.runMutation(api.agentTeam.executions.updateStatus, {
        executionId,
        status: "failed",
        errorDetails: error.message ?? "Unknown error",
        durationMs,
      });

      await ctx.runMutation(api.agentTeam.agents.updateStatus, {
        agentId: args.agentId,
        status: "error",
      });

      throw error;
    }
  },
});
