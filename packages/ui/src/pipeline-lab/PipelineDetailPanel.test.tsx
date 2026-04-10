import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import type { MockRequirement, PipelineStageConfig } from "./pipeline-types";

vi.mock("./PipelineStepper", () => ({
  PipelineStepper: () => <div>Stepper Mock</div>,
}));

const stages: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
  { id: "gap_analysis", label: "Gap Analysis", shortLabel: "GAP", order: 1 },
  { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 2 },
  { id: "deployed", label: "Deployed", shortLabel: "LIVE", order: 3 },
];

const requirement: MockRequirement = {
  id: "req-1",
  refId: "CAT-001",
  title: "Product attribute mapping",
  workstreamId: "ws-catalog",
  currentStage: "implementation",
  health: "on_track",
  priority: "must_have",
  fitGap: "config",
  effort: "medium",
  daysInStage: 4,
  stageHistory: [
    { stage: "discovery", enteredAt: "2026-01-10", exitedAt: "2026-01-15" },
    { stage: "implementation", enteredAt: "2026-01-15" },
  ],
  aiRecommendation: "Consider breaking this into smaller tasks.",
};

describe("PipelineDetailPanel", () => {
  it("renders requirement refId and title", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("CAT-001")).toBeInTheDocument();
    expect(screen.getByText("Product attribute mapping")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
  });

  it("renders fitGap badge", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("Config")).toBeInTheDocument();
  });

  it("renders effort badge", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders health badge", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("On Track")).toBeInTheDocument();
  });

  it("renders current stage and days in stage", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    const implTexts = screen.getAllByText("Implementation");
    expect(implTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4d")).toBeInTheDocument();
  });

  it("renders AI recommendation when present", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("AI Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Consider breaking this into smaller tasks.")).toBeInTheDocument();
  });

  it("does not render AI recommendation when absent", () => {
    const noAiReq = { ...requirement, aiRecommendation: undefined };
    render(<PipelineDetailPanel requirement={noAiReq} stages={stages} onClose={vi.fn()} />);
    expect(screen.queryByText("AI Recommendation")).not.toBeInTheDocument();
  });

  it("renders stage history entries", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("Stage History")).toBeInTheDocument();
    expect(screen.getByText("2026-01-10 — 2026-01-15")).toBeInTheDocument();
    expect(screen.getByText("2026-01-15 — present")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={onClose} />);
    const closeBtn = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg path[d='M6 18L18 6M6 6l12 12']"));
    if (closeBtn) await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <PipelineDetailPanel requirement={requirement} stages={stages} onClose={onClose} />,
    );
    const backdrop = container.querySelector(".bg-black\\/20");
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders pipeline stepper", () => {
    render(<PipelineDetailPanel requirement={requirement} stages={stages} onClose={vi.fn()} />);
    expect(screen.getByText("Pipeline Progress")).toBeInTheDocument();
    expect(screen.getByText("Stepper Mock")).toBeInTheDocument();
  });
});
