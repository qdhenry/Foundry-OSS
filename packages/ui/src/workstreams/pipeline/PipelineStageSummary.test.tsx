import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageSummary } from "./PipelineStageSummary";
import type { PipelineStage } from "./pipelineStage";

const zeroCounts: Record<PipelineStage, number> = {
  discovery: 0,
  requirement: 3,
  sprint_planning: 2,
  task_generation: 0,
  subtask_generation: 0,
  implementation: 5,
  testing: 1,
  review: 0,
};

describe("PipelineStageSummary", () => {
  it("renders overview heading and total", () => {
    render(
      <PipelineStageSummary
        counts={zeroCounts}
        activeStage={null}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText("Pipeline Overview")).toBeInTheDocument();
    expect(screen.getByText("11 requirements total")).toBeInTheDocument();
  });

  it("renders pills for all 8 stages", () => {
    render(
      <PipelineStageSummary
        counts={zeroCounts}
        activeStage={null}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText("Disc.")).toBeInTheDocument();
    expect(screen.getByText("Req")).toBeInTheDocument();
    expect(screen.getByText("Impl")).toBeInTheDocument();
    expect(screen.getByText("Rev")).toBeInTheDocument();
  });

  it("calls onStageClick when pill clicked", async () => {
    const user = userEvent.setup();
    const onStageClick = vi.fn();
    render(
      <PipelineStageSummary
        counts={zeroCounts}
        activeStage={null}
        onStageClick={onStageClick}
        total={11}
      />,
    );
    await user.click(screen.getByText("Impl"));
    expect(onStageClick).toHaveBeenCalledWith("implementation");
  });

  it("toggles off when active stage clicked again", async () => {
    const user = userEvent.setup();
    const onStageClick = vi.fn();
    render(
      <PipelineStageSummary
        counts={zeroCounts}
        activeStage={"implementation"}
        onStageClick={onStageClick}
        total={11}
      />,
    );
    await user.click(screen.getByText("Impl"));
    expect(onStageClick).toHaveBeenCalledWith(null);
  });

  it("shows filter indicator when stage is active", () => {
    render(
      <PipelineStageSummary
        counts={zeroCounts}
        activeStage={"implementation"}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText(/Filtered:/)).toBeInTheDocument();
    expect(screen.getByText("Implementation")).toBeInTheDocument();
  });
});
