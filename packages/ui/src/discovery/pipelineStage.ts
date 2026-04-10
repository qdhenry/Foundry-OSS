export const PIPELINE_STAGES = [
  "discovery",
  "requirement",
  "sprint_planning",
  "task_generation",
  "subtask_generation",
  "implementation",
  "testing",
  "review",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_ORDER: Record<PipelineStage, number> = {
  discovery: 0,
  requirement: 1,
  sprint_planning: 2,
  task_generation: 3,
  subtask_generation: 4,
  implementation: 5,
  testing: 6,
  review: 7,
};

export const PIPELINE_STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; shortLabel: string; order: number }
> = {
  discovery: { label: "Discovery", shortLabel: "Disc.", order: 0 },
  requirement: { label: "Requirement", shortLabel: "Req", order: 1 },
  sprint_planning: {
    label: "Sprint Planning",
    shortLabel: "Sprint",
    order: 2,
  },
  task_generation: {
    label: "Task Generation",
    shortLabel: "Tasks",
    order: 3,
  },
  subtask_generation: {
    label: "Subtask Generation",
    shortLabel: "Subtasks",
    order: 4,
  },
  implementation: { label: "Implementation", shortLabel: "Impl", order: 5 },
  testing: { label: "Testing", shortLabel: "Test", order: 6 },
  review: { label: "Review", shortLabel: "Rev", order: 7 },
};
