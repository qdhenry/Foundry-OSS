import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipelineStepper } from "./PipelineStepper";

const stages = [
  { id: "discovery" as const, label: "Discovery", shortLabel: "Disc", order: 0 },
  { id: "gap_analysis" as const, label: "Gap Analysis", shortLabel: "Gap", order: 1 },
  { id: "implementation" as const, label: "Implementation", shortLabel: "Impl", order: 4 },
  { id: "testing" as const, label: "Testing", shortLabel: "Test", order: 5 },
];

describe("PipelineStepper", () => {
  it("renders all stage short labels", () => {
    render(<PipelineStepper currentStage="discovery" stages={stages} />);
    expect(screen.getByText("Disc")).toBeInTheDocument();
    expect(screen.getByText("Gap")).toBeInTheDocument();
    expect(screen.getByText("Impl")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("marks earlier stages as completed with checkmark", () => {
    const { container } = render(<PipelineStepper currentStage="implementation" stages={stages} />);
    const blueCircles = container.querySelectorAll(".bg-blue-500");
    // Discovery, Gap Analysis = completed, Implementation = current (also blue)
    expect(blueCircles.length).toBeGreaterThanOrEqual(3);
  });

  it("renders step numbers for future stages (order+1)", () => {
    render(<PipelineStepper currentStage="discovery" stages={stages} />);
    // Future stage numbers are order+1: gap=2, impl=5, test=6
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});
