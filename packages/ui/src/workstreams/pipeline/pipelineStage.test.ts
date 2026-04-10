import { describe, expect, it } from "vitest";
import {
  calculateAggregateProgress,
  calculateRequirementProgress,
  derivePipelineStage,
  PIPELINE_STAGE_CONFIG,
  PIPELINE_STAGE_CUMULATIVE,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGE_WEIGHTS,
  PIPELINE_STAGES,
  pipelineSortComparator,
} from "./pipelineStage";

describe("pipelineStage constants", () => {
  it("has 8 pipeline stages", () => {
    expect(PIPELINE_STAGES).toHaveLength(8);
  });

  it("has config for every stage", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(PIPELINE_STAGE_CONFIG[stage]).toBeDefined();
      expect(PIPELINE_STAGE_CONFIG[stage].label).toBeTruthy();
      expect(PIPELINE_STAGE_CONFIG[stage].shortLabel).toBeTruthy();
    }
  });

  it("has sequential order values", () => {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      expect(PIPELINE_STAGE_ORDER[PIPELINE_STAGES[i]]).toBe(i);
    }
  });

  it("weights sum to 100", () => {
    const total = Object.values(PIPELINE_STAGE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("cumulative reaches 100 at review", () => {
    expect(PIPELINE_STAGE_CUMULATIVE.review).toBe(100);
  });
});

describe("derivePipelineStage", () => {
  it("returns discovery when finding is pending", () => {
    const result = derivePipelineStage({
      requirement: { status: "draft", sprintId: null },
      finding: { status: "pending" },
      decomposition: null,
      tasks: [],
    });
    expect(result).toBe("discovery");
  });

  it("returns requirement when no sprint and no tasks", () => {
    const result = derivePipelineStage({
      requirement: { status: "draft", sprintId: null },
      finding: null,
      decomposition: null,
      tasks: [],
    });
    expect(result).toBe("requirement");
  });

  it("returns sprint_planning when sprint assigned but no tasks", () => {
    const result = derivePipelineStage({
      requirement: { status: "approved", sprintId: "sprint-1" },
      finding: null,
      decomposition: null,
      tasks: [],
    });
    expect(result).toBe("sprint_planning");
  });

  it("returns task_generation when decomposition is processing", () => {
    const result = derivePipelineStage({
      requirement: { status: "approved", sprintId: "sprint-1" },
      finding: null,
      decomposition: { status: "processing" },
      tasks: [],
    });
    expect(result).toBe("task_generation");
  });

  it("returns task_generation when decomposition is pending_review", () => {
    const result = derivePipelineStage({
      requirement: { status: "approved", sprintId: "sprint-1" },
      finding: null,
      decomposition: { status: "pending_review" },
      tasks: [{ status: "backlog" }],
    });
    expect(result).toBe("task_generation");
  });

  it("returns implementation when any task in_progress", () => {
    const result = derivePipelineStage({
      requirement: { status: "in_progress", sprintId: "sprint-1" },
      finding: null,
      decomposition: null,
      tasks: [{ status: "in_progress" }, { status: "backlog" }],
    });
    expect(result).toBe("implementation");
  });

  it("returns testing when all tasks review or done with at least one review", () => {
    const result = derivePipelineStage({
      requirement: { status: "in_progress", sprintId: "sprint-1" },
      finding: null,
      decomposition: null,
      tasks: [{ status: "review" }, { status: "done" }],
    });
    expect(result).toBe("testing");
  });

  it("returns review when all tasks done", () => {
    const result = derivePipelineStage({
      requirement: { status: "in_progress", sprintId: "sprint-1" },
      finding: null,
      decomposition: null,
      tasks: [{ status: "done" }, { status: "done" }],
    });
    expect(result).toBe("review");
  });

  it("returns task_generation when all tasks are in backlog", () => {
    const result = derivePipelineStage({
      requirement: { status: "approved", sprintId: "sprint-1" },
      finding: null,
      decomposition: null,
      tasks: [{ status: "backlog" }, { status: "todo" }],
    });
    expect(result).toBe("task_generation");
  });

  it("returns subtask_generation when subtask gen is pending", () => {
    const result = derivePipelineStage({
      requirement: { status: "approved", sprintId: "sprint-1" },
      finding: null,
      decomposition: null,
      tasks: [{ status: "backlog", hasSubtasks: false, subtaskGenerationStatus: "pending" }],
    });
    expect(result).toBe("subtask_generation");
  });
});

describe("calculateRequirementProgress", () => {
  it("returns 0 for discovery stage", () => {
    expect(calculateRequirementProgress("discovery")).toBe(0);
  });

  it("returns cumulative weight of previous stage", () => {
    expect(calculateRequirementProgress("requirement")).toBe(5);
    expect(calculateRequirementProgress("sprint_planning")).toBe(10);
  });

  it("returns 90 for review stage", () => {
    expect(calculateRequirementProgress("review")).toBe(90);
  });
});

describe("calculateAggregateProgress", () => {
  it("returns 0 for empty input", () => {
    expect(calculateAggregateProgress({})).toBe(0);
  });

  it("calculates weighted average across stages", () => {
    const result = calculateAggregateProgress({ review: 2 });
    expect(result).toBe(90); // 2 * 90 / 2
  });

  it("mixes stages correctly", () => {
    const result = calculateAggregateProgress({ discovery: 1, review: 1 });
    expect(result).toBe(45); // (0 + 90) / 2
  });
});

describe("pipelineSortComparator", () => {
  it("sorts by stage first", () => {
    const a = { pipelineStage: "discovery" as const, priority: "deferred" };
    const b = { pipelineStage: "review" as const, priority: "must_have" };
    expect(pipelineSortComparator(a, b)).toBeLessThan(0);
  });

  it("sorts by priority within same stage", () => {
    const a = { pipelineStage: "requirement" as const, priority: "must_have" };
    const b = { pipelineStage: "requirement" as const, priority: "deferred" };
    expect(pipelineSortComparator(a, b)).toBeLessThan(0);
  });

  it("returns 0 for identical stage and priority", () => {
    const item = { pipelineStage: "testing" as const, priority: "should_have" };
    expect(pipelineSortComparator(item, item)).toBe(0);
  });
});
