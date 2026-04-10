import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineDetailPanel } from "./PipelineDetailPanel";

vi.mock("./PipelineStepper", () => ({
  PipelineStepper: ({ currentStage }: any) => (
    <div data-testid="pipeline-stepper">Stage: {currentStage}</div>
  ),
}));

const mockStages = [
  { id: "discovery" as const, label: "Discovery", shortLabel: "Disc", order: 0 },
  { id: "gap_analysis" as const, label: "Gap Analysis", shortLabel: "Gap", order: 1 },
  { id: "implementation" as const, label: "Implementation", shortLabel: "Impl", order: 4 },
];

const mockRequirement = {
  id: "req-1",
  refId: "BM-001",
  title: "Customer Account Management",
  workstreamId: "ws-1",
  currentStage: "implementation" as const,
  health: "on_track" as const,
  priority: "must_have" as const,
  fitGap: "custom_dev" as const,
  effort: "high" as const,
  daysInStage: 3,
  stageHistory: [],
};

describe("PipelineDetailPanel", () => {
  it("renders requirement refId and title", () => {
    render(
      <PipelineDetailPanel requirement={mockRequirement} stages={mockStages} onClose={vi.fn()} />,
    );
    expect(screen.getByText("BM-001")).toBeInTheDocument();
    expect(screen.getByText("Customer Account Management")).toBeInTheDocument();
  });

  it("renders priority, fit/gap, and effort labels", () => {
    render(
      <PipelineDetailPanel requirement={mockRequirement} stages={mockStages} onClose={vi.fn()} />,
    );
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders PipelineStepper with current stage", () => {
    render(
      <PipelineDetailPanel requirement={mockRequirement} stages={mockStages} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("pipeline-stepper")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <PipelineDetailPanel requirement={mockRequirement} stages={mockStages} onClose={onClose} />,
    );
    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows days in stage count", () => {
    render(
      <PipelineDetailPanel requirement={mockRequirement} stages={mockStages} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
