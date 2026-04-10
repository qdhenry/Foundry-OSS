import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStepper } from "./PipelineStepper";

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGES: [
    "discovery",
    "requirement",
    "sprint_planning",
    "task_generation",
    "subtask_generation",
    "implementation",
    "testing",
    "review",
  ],
  PIPELINE_STAGE_ORDER: {
    discovery: 0,
    requirement: 1,
    sprint_planning: 2,
    task_generation: 3,
    subtask_generation: 4,
    implementation: 5,
    testing: 6,
    review: 7,
  },
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc" },
    requirement: { label: "Requirement", shortLabel: "Req" },
    sprint_planning: { label: "Sprint Planning", shortLabel: "Sprint" },
    task_generation: { label: "Task Generation", shortLabel: "Tasks" },
    subtask_generation: { label: "Subtask Generation", shortLabel: "Sub" },
    implementation: { label: "Implementation", shortLabel: "Impl" },
    testing: { label: "Testing", shortLabel: "Test" },
    review: { label: "Review", shortLabel: "Rev" },
  },
}));

describe("PipelineStepper", () => {
  it("renders all stage short labels on desktop", () => {
    render(<PipelineStepper currentStage={"implementation" as any} />);
    expect(screen.getAllByText("Disc").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Req").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Impl").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Rev").length).toBeGreaterThanOrEqual(1);
  });

  it("shows current stage number", () => {
    render(<PipelineStepper currentStage={"implementation" as any} />);
    // Stage 6 (order 5 + 1) should be visible
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onStageClick when a stage is clicked", async () => {
    const onStageClick = vi.fn();
    const user = userEvent.setup();
    render(<PipelineStepper currentStage={"implementation" as any} onStageClick={onStageClick} />);
    // Click the first "Disc" button
    const discButtons = screen.getAllByText("Disc");
    await user.click(discButtons[0]);
    expect(onStageClick).toHaveBeenCalledWith("discovery");
  });

  it("shows Show all stages button on mobile view", () => {
    render(<PipelineStepper currentStage={"implementation" as any} />);
    expect(screen.getByText(/Show all stages/)).toBeInTheDocument();
  });
});
