import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageSummary } from "./PipelineStageSummary";

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGES: ["discovery", "requirement", "implementation", "review"],
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc" },
    requirement: { label: "Requirement", shortLabel: "Req" },
    implementation: { label: "Implementation", shortLabel: "Impl" },
    review: { label: "Review", shortLabel: "Rev" },
  },
}));

const baseCounts = {
  discovery: 3,
  requirement: 5,
  implementation: 2,
  review: 1,
} as any;

describe("PipelineStageSummary", () => {
  it("renders Pipeline Overview heading", () => {
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={null}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText("Pipeline Overview")).toBeInTheDocument();
  });

  it("renders total requirements count", () => {
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={null}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText("11 requirements total")).toBeInTheDocument();
  });

  it("renders singular total", () => {
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={null}
        onStageClick={vi.fn()}
        total={1}
      />,
    );
    expect(screen.getByText("1 requirement total")).toBeInTheDocument();
  });

  it("renders stage pills with short labels and counts", () => {
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={null}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText("Disc")).toBeInTheDocument();
    expect(screen.getByText("Req")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls onStageClick with stage when pill clicked", async () => {
    const onStageClick = vi.fn();
    const user = userEvent.setup();
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={null}
        onStageClick={onStageClick}
        total={11}
      />,
    );
    await user.click(screen.getByText("Disc"));
    expect(onStageClick).toHaveBeenCalledWith("discovery");
  });

  it("calls onStageClick with null when active stage clicked (toggle off)", async () => {
    const onStageClick = vi.fn();
    const user = userEvent.setup();
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={"discovery" as any}
        onStageClick={onStageClick}
        total={11}
      />,
    );
    await user.click(screen.getByText("Disc"));
    expect(onStageClick).toHaveBeenCalledWith(null);
  });

  it("shows active filter indicator when stage is active", () => {
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={"discovery" as any}
        onStageClick={vi.fn()}
        total={11}
      />,
    );
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("clears filter when Clear button clicked", async () => {
    const onStageClick = vi.fn();
    const user = userEvent.setup();
    render(
      <PipelineStageSummary
        counts={baseCounts}
        activeStage={"discovery" as any}
        onStageClick={onStageClick}
        total={11}
      />,
    );
    await user.click(screen.getByText("Clear"));
    expect(onStageClick).toHaveBeenCalledWith(null);
  });
});
