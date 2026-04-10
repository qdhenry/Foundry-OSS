import { describe, expect, it } from "vitest";
import type { EnrichedExecution } from "./utils";
import {
  computeMetrics,
  estimateCost,
  formatAbsoluteTime,
  formatOutput,
  formatTokens,
  getMetricBg,
  getMetricColor,
  groupByRequirement,
  humanizeTaskType,
  sanitizePreview,
  timeAgo,
} from "./utils";

describe("humanizeTaskType", () => {
  it("converts snake_case to Title Case", () => {
    expect(humanizeTaskType("code_review")).toBe("Code Review");
  });

  it("handles single word", () => {
    expect(humanizeTaskType("analysis")).toBe("Analysis");
  });

  it("handles multiple underscores", () => {
    expect(humanizeTaskType("gap_analysis_report")).toBe("Gap Analysis Report");
  });
});

describe("timeAgo", () => {
  it('returns "just now" for recent timestamps', () => {
    expect(timeAgo(Date.now() - 30_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(timeAgo(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(timeAgo(Date.now() - 2 * 86_400_000)).toBe("2d ago");
  });
});

describe("formatAbsoluteTime", () => {
  it("returns a formatted date string", () => {
    const result = formatAbsoluteTime(1_700_000_000_000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatTokens", () => {
  it("returns raw number for small values", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokens(2_500)).toBe("2.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1_500_000)).toBe("1.5M");
  });
});

describe("estimateCost", () => {
  it('returns "<$0.01" for tiny token counts', () => {
    expect(estimateCost(100)).toBe("<$0.01");
  });

  it("returns approximate dollar value for larger counts", () => {
    expect(estimateCost(1_000_000)).toBe("~$3.00");
  });
});

describe("sanitizePreview", () => {
  it("strips HTML/XML tags", () => {
    expect(sanitizePreview("Hello <b>world</b> test")).toBe("Hello world test");
  });

  it('returns "Agent execution output" for short/empty results', () => {
    expect(sanitizePreview("<div></div>")).toBe("Agent execution output");
  });

  it("collapses whitespace", () => {
    expect(sanitizePreview("hello   world   test content")).toBe("hello world test content");
  });
});

describe("formatOutput", () => {
  it("pretty-prints valid JSON", () => {
    const input = '{"key":"value"}';
    const result = formatOutput(input);
    expect(result).toContain('"key": "value"');
  });

  it("returns trimmed text for non-JSON input", () => {
    expect(formatOutput("  hello world  ")).toBe("hello world");
  });
});

describe("getMetricColor", () => {
  it("returns success color above green threshold", () => {
    expect(getMetricColor(90, { green: 80, yellow: 50 })).toBe("text-status-success-fg");
  });

  it("returns warning color between thresholds", () => {
    expect(getMetricColor(60, { green: 80, yellow: 50 })).toBe("text-status-warning-fg");
  });

  it("returns error color below yellow threshold", () => {
    expect(getMetricColor(30, { green: 80, yellow: 50 })).toBe("text-status-error-fg");
  });
});

describe("getMetricBg", () => {
  it("returns success bg above green threshold", () => {
    expect(getMetricBg(90, { green: 80, yellow: 50 })).toBe("bg-status-success-bg");
  });

  it("returns warning bg between thresholds", () => {
    expect(getMetricBg(60, { green: 80, yellow: 50 })).toBe("bg-status-warning-bg");
  });

  it("returns error bg below yellow threshold", () => {
    expect(getMetricBg(30, { green: 80, yellow: 50 })).toBe("bg-status-error-bg");
  });
});

function makeExecution(overrides: Partial<EnrichedExecution> = {}): EnrichedExecution {
  return {
    _id: "exec-1",
    _creationTime: Date.now(),
    programId: "prog-1",
    taskType: "code_review",
    trigger: "manual",
    reviewStatus: "pending",
    ...overrides,
  };
}

describe("computeMetrics", () => {
  it("computes 100% acceptance rate with no reviewed executions", () => {
    const result = computeMetrics([makeExecution()], 10);
    expect(result.acceptanceRate).toBe(100);
  });

  it("computes correct acceptance rate", () => {
    const execs = [
      makeExecution({ _id: "1", reviewStatus: "accepted" }),
      makeExecution({ _id: "2", reviewStatus: "rejected" }),
    ];
    const result = computeMetrics(execs, 5);
    expect(result.acceptanceRate).toBe(50);
    expect(result.acceptedCount).toBe(1);
    expect(result.reviewedCount).toBe(2);
  });

  it("sums tokens correctly", () => {
    const execs = [
      makeExecution({ _id: "1", tokensUsed: 1000 }),
      makeExecution({ _id: "2", tokensUsed: 2000 }),
    ];
    const result = computeMetrics(execs, 0);
    expect(result.totalTokens).toBe(3000);
  });

  it("computes coverage percentage", () => {
    const execs = [
      makeExecution({ _id: "1", requirementId: "req-1" }),
      makeExecution({ _id: "2", requirementId: "req-2" }),
      makeExecution({ _id: "3", requirementId: "req-1" }),
    ];
    const result = computeMetrics(execs, 4);
    expect(result.coveragePercent).toBe(50);
    expect(result.coveredCount).toBe(2);
  });
});

describe("groupByRequirement", () => {
  it("groups executions by requirement ID", () => {
    const execs = [
      makeExecution({
        _id: "1",
        requirementId: "req-1",
        requirementRefId: "REQ-001",
        requirementTitle: "Auth",
      }),
      makeExecution({
        _id: "2",
        requirementId: "req-1",
        requirementRefId: "REQ-001",
        requirementTitle: "Auth",
      }),
      makeExecution({
        _id: "3",
        requirementId: "req-2",
        requirementRefId: "REQ-002",
        requirementTitle: "Billing",
      }),
    ];
    const groups = groupByRequirement(execs);
    expect(groups).toHaveLength(2);
  });

  it("groups unlinked executions by taskId", () => {
    const execs = [
      makeExecution({ _id: "1", taskId: "task-1", taskTitle: "Fix bug" }),
      makeExecution({ _id: "2", taskId: "task-1", taskTitle: "Fix bug" }),
    ];
    const groups = groupByRequirement(execs);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalCount).toBe(2);
  });

  it("counts accepted executions as success", () => {
    const execs = [
      makeExecution({ _id: "1", requirementId: "req-1", reviewStatus: "accepted" }),
      makeExecution({ _id: "2", requirementId: "req-1", reviewStatus: "rejected" }),
    ];
    const groups = groupByRequirement(execs);
    expect(groups[0].successCount).toBe(1);
    expect(groups[0].totalCount).toBe(2);
  });

  it("sorts groups by most recent execution", () => {
    const now = Date.now();
    const execs = [
      makeExecution({ _id: "1", requirementId: "req-1", _creationTime: now - 10000 }),
      makeExecution({ _id: "2", requirementId: "req-2", _creationTime: now }),
    ];
    const groups = groupByRequirement(execs);
    expect(groups[0].requirementId).toBe("req-2");
  });
});
