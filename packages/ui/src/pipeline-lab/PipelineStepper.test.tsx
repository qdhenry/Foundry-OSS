import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipelineStepper } from "./PipelineStepper";
import type { PipelineStageConfig } from "./pipeline-types";

const stages: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
  { id: "gap_analysis", label: "Gap Analysis", shortLabel: "GAP", order: 1 },
  { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 2 },
  { id: "testing", label: "Testing", shortLabel: "TEST", order: 3 },
  { id: "deployed", label: "Deployed", shortLabel: "LIVE", order: 4 },
];

describe("PipelineStepper (pipeline-lab)", () => {
  it("renders all stage short labels", () => {
    render(<PipelineStepper currentStage="implementation" stages={stages} />);
    expect(screen.getAllByText("DISC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("GAP").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IMPL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("TEST").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("LIVE").length).toBeGreaterThanOrEqual(1);
  });

  it("shows stage number for current and future stages", () => {
    render(<PipelineStepper currentStage="implementation" stages={stages} />);
    // Current stage (implementation) is order 2, shown as 3
    expect(screen.getByText("3")).toBeInTheDocument();
    // Future stages: testing (4) and deployed (5)
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows checkmark SVG for completed stages", () => {
    const { container } = render(<PipelineStepper currentStage="implementation" stages={stages} />);
    // Completed stages get check SVGs (discovery, gap_analysis)
    const checkPaths = container.querySelectorAll("path[d='M5 13l4 4L19 7']");
    expect(checkPaths.length).toBe(2);
  });

  it("renders connecting lines between stages", () => {
    const { container } = render(<PipelineStepper currentStage="implementation" stages={stages} />);
    // 4 connecting lines for 5 stages
    const lines = container.querySelectorAll(".h-0\\.5");
    expect(lines.length).toBe(4);
  });

  it("handles first stage as current", () => {
    render(<PipelineStepper currentStage="discovery" stages={stages} />);
    // No checkmarks when first stage is current
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("handles last stage as current", () => {
    const { container } = render(<PipelineStepper currentStage="deployed" stages={stages} />);
    // All previous stages show checkmarks
    const checkPaths = container.querySelectorAll("path[d='M5 13l4 4L19 7']");
    expect(checkPaths.length).toBe(4);
  });
});
