import { defineTable } from "convex/server";
import { v } from "convex/values";

export const orchestrationScopeTypeValidator = v.union(
  v.literal("sprint"),
  v.literal("workstream"),
  v.literal("custom"),
);

export const orchestrationBranchStrategyValidator = v.union(
  v.literal("per_agent"),
  v.literal("per_task"),
  v.literal("single_branch"),
  v.literal("custom"),
);

export const orchestrationRunStatusValidator = v.union(
  v.literal("draft"),
  v.literal("previewing"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const orchestrationEventTypeValidator = v.union(
  v.literal("run_started"),
  v.literal("wave_started"),
  v.literal("task_dispatched"),
  v.literal("task_completed"),
  v.literal("task_failed"),
  v.literal("task_retried"),
  v.literal("task_reassigned"),
  v.literal("agent_paused"),
  v.literal("agent_resumed"),
  v.literal("budget_warning"),
  v.literal("run_paused"),
  v.literal("run_completed"),
  v.literal("run_failed"),
  v.literal("run_cancelled"),
  v.literal("pr_created"),
  v.literal("task_added"),
  v.literal("model_escalated"),
);

export const orchestrationRuns = defineTable({
  orgId: v.string(),
  programId: v.id("programs"),
  name: v.string(),
  scopeType: orchestrationScopeTypeValidator,
  sprintId: v.optional(v.id("sprints")),
  workstreamId: v.optional(v.id("workstreams")),
  taskIds: v.optional(v.array(v.id("tasks"))),
  repositoryIds: v.array(v.id("sourceControlRepositories")),
  branchStrategy: orchestrationBranchStrategyValidator,
  branchPattern: v.optional(v.string()),
  targetBranch: v.string(),
  maxConcurrency: v.number(),
  tokenBudget: v.number(),
  tokensUsed: v.number(),
  totalCost: v.number(),
  status: orchestrationRunStatusValidator,
  workflowId: v.optional(v.string()),
  executionPlan: v.optional(v.any()),
  report: v.optional(v.any()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  startedBy: v.id("users"),
})
  .index("by_program", ["programId"])
  .index("by_status", ["status"])
  .index("by_sprint", ["sprintId"])
  .index("by_workstream", ["workstreamId"])
  .index("by_org", ["orgId"]);

export const orchestrationEvents = defineTable({
  orgId: v.string(),
  runId: v.id("orchestrationRuns"),
  type: orchestrationEventTypeValidator,
  agentId: v.optional(v.id("programAgents")),
  taskId: v.optional(v.id("tasks")),
  message: v.string(),
  metadata: v.optional(v.any()),
})
  .index("by_run", ["runId"])
  .index("by_run_type", ["runId", "type"]);
