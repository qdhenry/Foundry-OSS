// Pipeline Lab Types

export type PipelineStage =
  | "discovery"
  | "gap_analysis"
  | "solution_design"
  | "sprint_planning"
  | "implementation"
  | "testing"
  | "uat"
  | "deployed";

export type PipelineStageConfig = {
  id: PipelineStage;
  label: string;
  shortLabel: string;
  order: number;
};

export type RequirementHealth = "on_track" | "at_risk" | "blocked";

export type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";

export type FitGap = "native" | "config" | "custom_dev" | "third_party" | "not_feasible";

export type Effort = "low" | "medium" | "high" | "very_high";

export type StageHistoryEntry = {
  stage: PipelineStage;
  enteredAt: string;
  exitedAt?: string;
};

export type MockRequirement = {
  id: string;
  refId: string;
  title: string;
  workstreamId: string;
  currentStage: PipelineStage;
  health: RequirementHealth;
  priority: Priority;
  fitGap: FitGap;
  effort: Effort;
  daysInStage: number;
  stageHistory: StageHistoryEntry[];
  aiRecommendation?: string;
};

export type MockWorkstream = {
  id: string;
  name: string;
  shortCode: string;
  color: string;
  requirements: string[];
};
