import { v } from "convex/values";

export const implementationStatusValidator = v.union(
  v.literal("not_found"),
  v.literal("partially_implemented"),
  v.literal("fully_implemented"),
  v.literal("needs_verification"),
);

export const analysisRunStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const analysisScopeValidator = v.union(
  v.literal("requirement"),
  v.literal("workstream"),
  v.literal("program"),
  v.literal("task"),
);

export const analysisModelTierValidator = v.union(
  v.literal("fast"),
  v.literal("standard"),
  v.literal("thorough"),
);

export const resultReviewStatusValidator = v.union(
  v.literal("auto_applied"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("regression_flagged"),
);

export const subtaskProposalTypeValidator = v.union(
  v.literal("status_change"),
  v.literal("rewrite"),
  v.literal("new_subtask"),
  v.literal("skip"),
);

export const subtaskProposalReviewValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const analysisConfigValidator = v.object({
  branch: v.string(),
  directoryFilter: v.optional(v.string()),
  fileTypeFilter: v.optional(v.array(v.string())),
  confidenceThreshold: v.number(),
  modelTier: analysisModelTierValidator,
  useKnowledgeGraph: v.boolean(),
});

export const evidenceFileValidator = v.object({
  repositoryId: v.string(),
  filePath: v.string(),
  lineStart: v.optional(v.number()),
  lineEnd: v.optional(v.number()),
  snippet: v.optional(v.string()),
  relevance: v.string(),
});

export const analysisSummaryValidator = v.object({
  notFound: v.number(),
  partiallyImplemented: v.number(),
  fullyImplemented: v.number(),
  needsVerification: v.number(),
  autoApplied: v.number(),
  pendingReview: v.number(),
});

export const tokenUsageValidator = v.object({
  input: v.number(),
  output: v.number(),
  cost: v.number(),
});
