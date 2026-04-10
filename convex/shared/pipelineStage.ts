/**
 * Pipeline Stage Derivation Utility
 *
 * Shared module importable by both Convex server functions and Next.js client.
 * The pipeline stage is DERIVED from existing data — never stored directly.
 *
 * Ambiguity rule: "Lowest active stage wins."
 * If any linked task is still in_progress while others are in review,
 * the requirement stays in "implementation" until ALL tasks advance.
 */

// ── Stage Definitions ────────────────────────────────────────────────

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

// ── Progress Weights ─────────────────────────────────────────────────

/** Front-loaded effort weights per stage. Values sum to 100. */
export const PIPELINE_STAGE_WEIGHTS: Record<PipelineStage, number> = {
  discovery: 5,
  requirement: 5,
  sprint_planning: 10,
  task_generation: 10,
  subtask_generation: 10,
  implementation: 30,
  testing: 20,
  review: 10,
};

/** Cumulative weight at completion of each stage */
export const PIPELINE_STAGE_CUMULATIVE: Record<PipelineStage, number> = {
  discovery: 5,
  requirement: 10,
  sprint_planning: 20,
  task_generation: 30,
  subtask_generation: 40,
  implementation: 70,
  testing: 90,
  review: 100,
};

// ── Derivation Types ─────────────────────────────────────────────────

export interface FindingContext {
  status: string; // "pending" | "approved" | "rejected" | "imported" | "edited"
}

export interface DecompositionContext {
  status: string; // "processing" | "pending_review" | "accepted" | "rejected" | "error"
}

export interface TaskContext {
  status: string; // "backlog" | "todo" | "in_progress" | "review" | "done"
  hasSubtasks?: boolean;
  subtaskGenerationStatus?: string;
}

export interface PipelineDerivationInput {
  /** The requirement's own fields */
  requirement: {
    status: string; // "draft" | "approved" | "in_progress" | "complete" | "deferred"
    workstreamId?: string | null;
    sprintId?: string | null;
  };
  /** Linked discovery finding (if requirement originated from one) */
  finding?: FindingContext | null;
  /** Task decomposition record for this requirement */
  decomposition?: DecompositionContext | null;
  /** All tasks linked to this requirement */
  tasks: TaskContext[];
}

// ── Derivation Function ──────────────────────────────────────────────

/**
 * Derive the pipeline stage from existing data. This is the canonical
 * pipeline stage derivation — used by both server queries and client
 * optimistic updates.
 *
 * Ambiguity rule: Lowest active stage wins.
 */
export function derivePipelineStage(input: PipelineDerivationInput): PipelineStage {
  const { requirement, finding, decomposition, tasks } = input;

  // Stage 1: Discovery — finding exists and is still pending review
  if (finding && finding.status === "pending") {
    return "discovery";
  }

  // If requirement has no sprint and no tasks, it's in the requirement stage
  if (!requirement.sprintId && tasks.length === 0) {
    return "requirement";
  }

  // Stage 3: Sprint Planning — has sprint, but no tasks generated yet
  if (requirement.sprintId && tasks.length === 0) {
    // Check if decomposition is actively processing
    if (
      decomposition &&
      (decomposition.status === "processing" || decomposition.status === "pending_review")
    ) {
      return "task_generation";
    }
    return "sprint_planning";
  }

  // Stage 4: Task Generation — decomposition in progress
  if (
    decomposition &&
    (decomposition.status === "processing" || decomposition.status === "pending_review")
  ) {
    return "task_generation";
  }

  // If tasks exist, analyze their states
  if (tasks.length > 0) {
    const allDone = tasks.every((t) => t.status === "done");
    const allReviewOrDone = tasks.every((t) => t.status === "review" || t.status === "done");
    const anyInProgress = tasks.some((t) => t.status === "in_progress");
    const anyReview = tasks.some((t) => t.status === "review");

    // Check for pending subtask generation on any task
    const anySubtaskGenPending = tasks.some(
      (t) =>
        t.hasSubtasks === false &&
        t.subtaskGenerationStatus &&
        (t.subtaskGenerationStatus === "pending" || t.subtaskGenerationStatus === "processing"),
    );

    // Stage 8: Review — all tasks done
    if (allDone) {
      return "review";
    }

    // Stage 7: Testing — all tasks are in review or done (lowest active = review)
    if (allReviewOrDone && anyReview) {
      return "testing";
    }

    // Stage 6: Implementation — any task in progress
    if (anyInProgress || anyReview) {
      return "implementation";
    }

    // Stage 5: Subtask Generation — tasks exist but subtask gen is pending
    if (anySubtaskGenPending) {
      return "subtask_generation";
    }

    // Tasks exist but are all in backlog/todo — still in task generation or sprint planning
    const allBacklogOrTodo = tasks.every((t) => t.status === "backlog" || t.status === "todo");
    if (allBacklogOrTodo) {
      return "task_generation";
    }
  }

  // Default fallback
  return "requirement";
}

// ── Progress Calculation ─────────────────────────────────────────────

/**
 * Calculate weighted progress percentage for a single requirement
 * based on its current pipeline stage.
 *
 * Returns a number between 0 and 100.
 */
export function calculateRequirementProgress(stage: PipelineStage): number {
  const order = PIPELINE_STAGE_ORDER[stage];
  if (order === 0) return 0;

  // Progress = cumulative weight of the PREVIOUS completed stage
  const stages = PIPELINE_STAGES;
  const previousStage = stages[order - 1];
  return PIPELINE_STAGE_CUMULATIVE[previousStage];
}

/**
 * Calculate weighted progress for a collection of requirements.
 * Returns a percentage (0-100).
 */
export function calculateAggregateProgress(
  stageCounts: Partial<Record<PipelineStage, number>>,
): number {
  let totalWeight = 0;
  let totalRequirements = 0;

  for (const stage of PIPELINE_STAGES) {
    const count = stageCounts[stage] ?? 0;
    if (count > 0) {
      totalRequirements += count;
      totalWeight += count * calculateRequirementProgress(stage);
    }
  }

  if (totalRequirements === 0) return 0;
  return Math.round(totalWeight / totalRequirements);
}

// ── Priority Sort Helpers ────────────────────────────────────────────

const PRIORITY_SORT_ORDER: Record<string, number> = {
  must_have: 0,
  should_have: 1,
  nice_to_have: 2,
  deferred: 3,
};

/**
 * Sort comparator: stage first (discovery → review), then priority within.
 */
export function pipelineSortComparator(
  a: { pipelineStage: PipelineStage; priority: string },
  b: { pipelineStage: PipelineStage; priority: string },
): number {
  const stageA = PIPELINE_STAGE_ORDER[a.pipelineStage];
  const stageB = PIPELINE_STAGE_ORDER[b.pipelineStage];
  if (stageA !== stageB) return stageA - stageB;

  const prioA = PRIORITY_SORT_ORDER[a.priority] ?? 99;
  const prioB = PRIORITY_SORT_ORDER[b.priority] ?? 99;
  return prioA - prioB;
}
