import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageProgress, summarizeSetupProgress } from "./StageProgress";

// Note: When input contains known stage keys (containerProvision, systemSetup, etc.),
// summarizeSetupProgress includes ALL 10 known stages from STAGE_ORDER.
// Missing stages default to "pending". Tests use custom unknown keys to test
// exact counts, or account for the full 10-stage expansion.

describe("summarizeSetupProgress", () => {
  it("returns null for undefined input", () => {
    expect(summarizeSetupProgress(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(summarizeSetupProgress("string")).toBeNull();
    expect(summarizeSetupProgress(42)).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(summarizeSetupProgress({})).toBeNull();
  });

  it("counts stage statuses correctly with custom keys", () => {
    // Use non-standard keys to avoid STAGE_ORDER expansion
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "completed" },
      stepC: { status: "running" },
      stepD: { status: "pending" },
    };
    const summary = summarizeSetupProgress(progress)!;
    expect(summary.completedStages).toBe(2);
    expect(summary.runningStages).toBe(1);
    expect(summary.pendingStages).toBe(1);
    expect(summary.totalStages).toBe(4);
    expect(summary.tone).toBe("running");
  });

  it("calculates progress percent based on completed+skipped+failed", () => {
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "skipped" },
      stepC: { status: "pending" },
      stepD: { status: "pending" },
    };
    const summary = summarizeSetupProgress(progress)!;
    expect(summary.progressPercent).toBe(50);
  });

  it("identifies current stage as running stage", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "running" },
    };
    const summary = summarizeSetupProgress(progress)!;
    expect(summary.currentStageKey).toBe("systemSetup");
    expect(summary.currentStageLabel).toBe("System Setup");
  });

  it("reports failed tone when only failed stages remain (custom keys)", () => {
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "failed" },
    };
    const summary = summarizeSetupProgress(progress)!;
    expect(summary.tone).toBe("failed");
  });

  it("reports completed tone when all stages are completed/skipped (custom keys)", () => {
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "completed" },
    };
    const summary = summarizeSetupProgress(progress)!;
    expect(summary.tone).toBe("completed");
  });

  it("expands known stages to full STAGE_ORDER when any known key present", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "completed" },
    };
    const summary = summarizeSetupProgress(progress)!;
    // All 10 known stages are included
    expect(summary.totalStages).toBe(10);
    expect(summary.completedStages).toBe(2);
    expect(summary.pendingStages).toBe(8);
  });
});

describe("StageProgress", () => {
  it("renders nothing when setupProgress is undefined", () => {
    const { container } = render(<StageProgress />);
    expect(container.innerHTML).toBe("");
  });

  it("renders progress bar in full mode", () => {
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "running" },
      stepC: { status: "pending" },
    };
    render(<StageProgress setupProgress={progress} />);
    expect(screen.getByText("Setup Progress")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("renders compact mode", () => {
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "running" },
    };
    render(<StageProgress setupProgress={progress} compact />);
    expect(screen.getByText("Setup 1/2")).toBeInTheDocument();
  });

  it("shows current stage label for known stages", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "running" },
    };
    render(<StageProgress setupProgress={progress} />);
    expect(screen.getByText("Current stage: System Setup")).toBeInTheDocument();
  });

  it("shows failed message when all custom stages resolved with failure", () => {
    const progress = {
      stepA: { status: "completed" },
      stepB: { status: "failed" },
    };
    render(<StageProgress setupProgress={progress} />);
    expect(screen.getByText(/Failed: Step B/)).toBeInTheDocument();
  });
});
