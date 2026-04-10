import { defineTable } from "convex/server";
import { v } from "convex/values";

export const agentRoleValidator = v.union(
  v.literal("architect"),
  v.literal("backend_engineer"),
  v.literal("frontend_engineer"),
  v.literal("fullstack_engineer"),
  v.literal("qa_engineer"),
  v.literal("devops"),
  v.literal("reviewer"),
  v.literal("project_manager"),
  v.literal("integration_specialist"),
  v.literal("orchestrator"),
);

export const agentModelValidator = v.union(
  v.literal("claude-opus-4-6"),
  v.literal("claude-sonnet-4-5-20250929"),
  v.literal("claude-sonnet-4-5-20250514"),
);

export const agentStatusValidator = v.union(
  v.literal("active"),
  v.literal("idle"),
  v.literal("executing"),
  v.literal("error"),
  v.literal("paused"),
  v.literal("archived"),
);

export const personalityProfileValidator = v.optional(
  v.object({
    communicationStyle: v.string(),
    decisionApproach: v.string(),
    emoji: v.optional(v.string()),
  }),
);

export const tokenBudgetValidator = v.object({
  perExecution: v.number(),
  perDay: v.number(),
});

export const agentTemplates = defineTable({
  orgId: v.string(),
  name: v.string(),
  description: v.string(),
  role: agentRoleValidator,
  model: agentModelValidator,
  tools: v.array(v.string()),
  systemPrompt: v.string(),
  constraints: v.array(v.string()),
  specializations: v.array(v.string()),
  personalityProfile: personalityProfileValidator,
  avatarSeed: v.string(),
  createdBy: v.id("users"),
})
  .index("by_org", ["orgId"])
  .index("by_org_role", ["orgId", "role"]);

export const programAgents = defineTable({
  orgId: v.string(),
  programId: v.id("programs"),
  templateId: v.optional(v.id("agentTemplates")),
  name: v.string(),
  description: v.string(),
  role: agentRoleValidator,
  model: agentModelValidator,
  tools: v.array(v.string()),
  systemPrompt: v.string(),
  constraints: v.array(v.string()),
  specializations: v.array(v.string()),
  personalityProfile: personalityProfileValidator,
  avatarSeed: v.string(),
  skillIds: v.array(v.id("skills")),
  workstreamIds: v.optional(v.array(v.id("workstreams"))),
  status: agentStatusValidator,
  currentVersion: v.number(),
  tokenBudget: tokenBudgetValidator,
  createdBy: v.id("users"),
})
  .index("by_program", ["programId"])
  .index("by_program_status", ["programId", "status"])
  .index("by_program_role", ["programId", "role"])
  .index("by_org", ["orgId"]);

export const agentVersions = defineTable({
  orgId: v.string(),
  agentId: v.id("programAgents"),
  version: v.number(),
  diff: v.any(),
  snapshot: v.any(),
  editedBy: v.id("users"),
})
  .index("by_agent", ["agentId"])
  .index("by_agent_version", ["agentId", "version"]);

export const agentTaskExecutions = defineTable({
  orgId: v.string(),
  programId: v.id("programs"),
  agentId: v.id("programAgents"),
  agentVersionId: v.id("agentVersions"),
  sprintWorkflowId: v.optional(v.id("sprintWorkflows")),
  taskId: v.optional(v.id("tasks")),
  executionMode: v.union(v.literal("sdk"), v.literal("sandbox")),
  sandboxSessionId: v.optional(v.id("sandboxSessions")),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("success"),
    v.literal("failed"),
    v.literal("retrying"),
    v.literal("reassigned"),
  ),
  inputSummary: v.string(),
  outputSummary: v.optional(v.string()),
  tokensUsed: v.object({
    input: v.number(),
    output: v.number(),
    total: v.number(),
  }),
  durationMs: v.number(),
  cost: v.number(),
  errorDetails: v.optional(v.string()),
  retryCount: v.number(),
  reassignedTo: v.optional(v.id("programAgents")),
  orchestrationRunId: v.optional(v.id("orchestrationRuns")),
})
  .index("by_agent", ["agentId"])
  .index("by_sprint_workflow", ["sprintWorkflowId"])
  .index("by_program", ["programId"])
  .index("by_agent_status", ["agentId", "status"])
  .index("by_orchestration_run", ["orchestrationRunId"]);

export const sprintWorkflows = defineTable({
  orgId: v.string(),
  programId: v.id("programs"),
  sprintId: v.id("sprintGates"),
  workflowId: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("paused"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("cancelled"),
  ),
  branchName: v.string(),
  prUrl: v.optional(v.string()),
  agentAssignments: v.array(
    v.object({
      agentId: v.id("programAgents"),
      taskId: v.id("tasks"),
      status: v.string(),
      sandboxSessionId: v.optional(v.id("sandboxSessions")),
    }),
  ),
  totalTokensUsed: v.number(),
  totalCost: v.number(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  startedBy: v.id("users"),
  pausedBy: v.optional(v.id("users")),
})
  .index("by_program", ["programId"])
  .index("by_sprint", ["sprintId"])
  .index("by_status", ["status"]);

export const agentNotifications = defineTable({
  orgId: v.string(),
  programId: v.id("programs"),
  agentId: v.optional(v.id("programAgents")),
  sprintWorkflowId: v.optional(v.id("sprintWorkflows")),
  type: v.union(
    v.literal("failure"),
    v.literal("completion"),
    v.literal("budget_warning"),
    v.literal("reassignment"),
    v.literal("sprint_complete"),
    v.literal("pr_created"),
  ),
  severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
  title: v.string(),
  message: v.string(),
  channels: v.array(v.string()),
  deliveredVia: v.array(v.string()),
  readAt: v.optional(v.number()),
})
  .index("by_program", ["programId"])
  .index("by_org_unread", ["orgId", "readAt"])
  .index("by_sprint_workflow", ["sprintWorkflowId"]);

export const orgAgentSettings = defineTable({
  orgId: v.string(),
  monthlyTokenBudget: v.number(),
  monthlyTokensUsed: v.number(),
  budgetResetDate: v.number(),
  maxConcurrentSandboxes: v.number(),
  webhookUrl: v.optional(v.string()),
  notificationPreferences: v.object({
    email: v.boolean(),
    webhook: v.boolean(),
    inApp: v.boolean(),
  }),
  defaultModel: agentModelValidator,
}).index("by_org", ["orgId"]);
