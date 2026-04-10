import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageProgress, summarizeSetupProgress } from "./StageProgress";

vi.mock("../theme/useAnimations", () => ({
  useProgressBar: vi.fn(),
}));

describe("summarizeSetupProgress", () => {
  it("returns null for null input", () => {
    expect(summarizeSetupProgress(null)).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(summarizeSetupProgress({})).toBeNull();
  });

  it("counts completed and running stages", () => {
    // Known stage keys cause STAGE_ORDER to be included (10 total stages)
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "completed" },
      authSetup: { status: "running" },
      claudeConfig: { status: "pending" },
    };
    const summary = summarizeSetupProgress(progress);
    expect(summary).not.toBeNull();
    expect(summary!.completedStages).toBe(2);
    expect(summary!.runningStages).toBe(1);
    expect(summary!.tone).toBe("running");
    // 10 stages total from STAGE_ORDER
    expect(summary!.totalStages).toBe(10);
  });

  it("calculates progress percent for custom stages", () => {
    // Use unknown keys to avoid STAGE_ORDER expansion
    const progress = {
      stageA: { status: "completed" },
      stageB: { status: "completed" },
    };
    const summary = summarizeSetupProgress(progress);
    expect(summary!.progressPercent).toBe(100);
  });

  it("detects failed tone", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "failed" },
    };
    const summary = summarizeSetupProgress(progress);
    expect(summary!.failedStages).toBe(1);
  });

  it("counts skipped stages", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "skipped" },
    };
    const summary = summarizeSetupProgress(progress);
    expect(summary!.skippedStages).toBe(1);
  });

  it("identifies current stage label", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "running" },
    };
    const summary = summarizeSetupProgress(progress);
    expect(summary!.currentStageKey).toBe("systemSetup");
    expect(summary!.currentStageLabel).toBe("System Setup");
  });
});

describe("StageProgress", () => {
  it("renders nothing when no setup progress", () => {
    const { container } = render(<StageProgress />);
    expect(container.firstChild).toBeNull();
  });

  it("renders progress bar with label", () => {
    const progress = {
      containerProvision: { status: "completed" },
      systemSetup: { status: "running" },
      authSetup: { status: "pending" },
    };
    render(<StageProgress setupProgress={progress} />);
    expect(screen.getByText("Setup Progress")).toBeInTheDocument();
    expect(screen.getByText(/Current stage: System Setup/)).toBeInTheDocument();
  });

  it("renders compact mode", () => {
    // Use unknown stage keys to avoid STAGE_ORDER expansion
    const progress = {
      stageA: { status: "completed" },
      stageB: { status: "running" },
    };
    render(<StageProgress setupProgress={progress} compact />);
    expect(screen.getByText(/Setup 1\/2/)).toBeInTheDocument();
  });
});
