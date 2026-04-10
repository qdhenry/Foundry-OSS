import { v } from "convex/values";

export const planSlugValidator = v.union(
  v.literal("crucible"),
  v.literal("forge"),
  v.literal("foundry"),
);

export const aiUsageSourceValidator = v.union(
  v.literal("document_analysis"),
  v.literal("design_analysis"),
  v.literal("video_analysis"),
  v.literal("skill_execution"),
  v.literal("subtask_generation"),
  v.literal("health_scoring"),
  v.literal("dependency_detection"),
  v.literal("sprint_planning"),
  v.literal("risk_assessment"),
  v.literal("gate_evaluation"),
  v.literal("daily_digest"),
  v.literal("pr_review"),
  v.literal("requirement_refinement"),
  v.literal("task_decomposition"),
  v.literal("sandbox_chat"),
  v.literal("other"),
);
