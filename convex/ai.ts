import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";
import { assemblePrompt } from "./model/context";

const internalApi: any = (generatedApi as any).internal;

// Internal query to fetch all context data for AI execution
export const getContextData = internalQuery({
  args: {
    programId: v.id("programs"),
    skillId: v.id("skills"),
    workstreamId: v.optional(v.id("workstreams")),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");

    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");

    // Requirements filtered by workstream if provided
    let requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (args.workstreamId) {
      requirements = requirements.filter((r) => r.workstreamId === args.workstreamId);
    }

    // Recent executions for this skill (last 5)
    const recentExecutions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .order("desc")
      .take(5);

    // Fetch design snapshot and task metadata if taskId provided
    let designSnapshot: {
      resolvedTokens: string;
      resolvedComponents: string;
      screenSpecs: string | null;
      interactionSpecs: string;
    } | null = null;
    let taskTitle: string | undefined;
    let taskDescription: string | undefined;

    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      if (task) {
        taskTitle = task.title;
        taskDescription = (task as any).description;

        const snapshots = await ctx.db
          .query("taskDesignSnapshots")
          .withIndex("by_task", (q) => q.eq("taskId", args.taskId!))
          .collect();

        if (snapshots.length > 0) {
          const snap = snapshots[snapshots.length - 1];
          designSnapshot = {
            resolvedTokens: snap.resolvedTokens,
            resolvedComponents: snap.resolvedComponents,
            screenSpecs: snap.screenSpecs ?? null,
            interactionSpecs: snap.interactionSpecs ?? "",
          };
        }
      }
    }

    // Codebase analysis results for context enrichment
    let codebaseAnalysis: any[] | undefined;
    try {
      const allResults = await ctx.db
        .query("codebaseAnalysisResults")
        .withIndex("by_org_program", (q) =>
          q.eq("orgId", program.orgId).eq("programId", args.programId),
        )
        .collect();
      const approvedResults = allResults.filter((r) => r.reviewStatus === "approved");

      if (approvedResults.length > 0) {
        const reqMap = new Map(requirements.map((r) => [r._id.toString(), r.refId]));
        codebaseAnalysis = approvedResults
          .filter((ar) => reqMap.has(ar.requirementId.toString()))
          .map((ar) => ({
            refId: reqMap.get(ar.requirementId.toString()) ?? "unknown",
            implementationStatus: ar.implementationStatus,
            confidence: ar.confidence,
            evidenceSummary: ar.confidenceReasoning,
            gapDescription: ar.gapDescription,
          }));
      }
    } catch {
      // Table may not exist yet; skip gracefully
    }

    return {
      program,
      requirements,
      skill,
      recentExecutions,
      designSnapshot,
      taskTitle,
      taskDescription,
      codebaseAnalysis,
    };
  },
});

// Internal mutation to log an agent execution
export const logExecution = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    skillId: v.optional(v.id("skills")),
    workstreamId: v.optional(v.id("workstreams")),
    taskId: v.optional(v.id("tasks")),
    executionMode: v.union(v.literal("local"), v.literal("platform")),
    trigger: v.union(
      v.literal("manual"),
      v.literal("pr_event"),
      v.literal("gate_trigger"),
      v.literal("scheduled"),
    ),
    taskType: v.string(),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentExecutions", {
      ...args,
      reviewStatus: "pending",
    });
  },
});

// Internal query to resolve userId from Clerk identity subject
export const getUserIdByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    return user?._id ?? null;
  },
});

// Public action to execute a skill via Claude API
export const executeSkill = action({
  args: {
    programId: v.id("programs"),
    skillId: v.id("skills"),
    workstreamId: v.optional(v.id("workstreams")),
    taskId: v.optional(v.id("tasks")),
    taskPrompt: v.string(),
    taskType: v.string(),
    orgId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    executionId: string;
    output: string;
    tokensUsed: number;
    durationMs: number;
  }> => {
    // 1. Verify auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // 2. Fetch context data via internal query
    const contextData = await ctx.runQuery(internalApi.ai.getContextData, {
      programId: args.programId,
      skillId: args.skillId,
      workstreamId: args.workstreamId,
      taskId: args.taskId,
    });

    // 3. Assemble prompt (includes design context from task snapshot if available)
    const prompt = assemblePrompt({
      ...contextData,
      taskPrompt: args.taskPrompt,
    });

    // 4. Call Claude API
    const client = getAnthropicClient();
    const startTime = Date.now();

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      system:
        "You are an AI agent specializing in software delivery. You have deep context about the current delivery program and must provide actionable, context-aware guidance.",
      messages: [{ role: "user", content: prompt }],
    });

    const durationMs = Date.now() - startTime;
    const outputText = response.content[0].type === "text" ? response.content[0].text : "";
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // 5. Resolve userId from Clerk identity
    const userId = await ctx.runQuery(internalApi.ai.getUserIdByClerkId, {
      clerkId: identity.subject,
    });

    // 6. Log execution (full text, no truncation)
    const executionId: string = await ctx.runMutation(internalApi.ai.logExecution, {
      orgId: args.orgId,
      programId: args.programId,
      skillId: args.skillId,
      workstreamId: args.workstreamId,
      taskId: args.taskId,
      executionMode: "platform" as const,
      trigger: "manual" as const,
      taskType: args.taskType,
      inputSummary: args.taskPrompt,
      outputSummary: outputText,
      tokensUsed,
      durationMs,
      userId: userId ?? undefined,
      modelId: "claude-sonnet-4-5-20250514",
    });

    // 7. Record AI usage for billing (best-effort)
    try {
      const tokenUsage = extractTokenUsage(response, "claude-sonnet-4-5-20250514");
      await ctx.runMutation(internalApi.billing.usageRecords.recordAiUsage, {
        orgId: args.orgId,
        programId: args.programId,
        source: "skill_execution" as const,
        claudeModelId: "claude-sonnet-4-5-20250514",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        cacheReadTokens: tokenUsage.cacheReadTokens,
        cacheCreationTokens: tokenUsage.cacheCreationTokens,
        costUsd: calculateCostUsd(tokenUsage),
        durationMs,
        sourceEntityId: String(executionId),
        sourceEntityTable: "agentExecutions",
      });
    } catch (e) {
      console.error("[billing] Failed to record skill execution usage:", e);
    }

    return {
      executionId,
      output: outputText,
      tokensUsed,
      durationMs,
    };
  },
});
