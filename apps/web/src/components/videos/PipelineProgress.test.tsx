import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipelineProgress } from "./PipelineProgress";

describe("PipelineProgress", () => {
  it("renders the 4-stage pipeline labels", () => {
    render(<PipelineProgress status="uploading" />);

    expect(screen.getByText("Uploading")).toBeInTheDocument();
    expect(screen.getByText("Indexing")).toBeInTheDocument();
    expect(screen.getByText("Analyzing")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("marks earlier stages as completed when pipeline is ahead", () => {
    const { container } = render(
      <PipelineProgress
        status="analyzing"
        stageTimestamps={{ uploadingAt: 1000, indexingAt: 2000, analyzingAt: 3000 }}
      />,
    );

    // Green check circles for completed stages (uploading, indexing)
    const greenCircles = container.querySelectorAll(".bg-green-500, .bg-green-600");
    expect(greenCircles.length).toBeGreaterThanOrEqual(2);
  });

  it("shows current stage with pulsing indicator", () => {
    const { container } = render(<PipelineProgress status="analyzing" />);

    const pulsingDots = container.querySelectorAll(".animate-ping");
    expect(pulsingDots.length).toBeGreaterThanOrEqual(1);
  });

  it("renders completed state with all green checks", () => {
    const { container } = render(
      <PipelineProgress
        status="complete"
        stageTimestamps={{
          uploadingAt: 1000,
          indexingAt: 2000,
          analyzingAt: 3000,
          completedAt: 4000,
        }}
      />,
    );

    const greenCircles = container.querySelectorAll(".bg-green-500, .bg-green-600");
    expect(greenCircles.length).toBe(4);
  });

  it("shows failed stage with error styling and error message", () => {
    const { container } = render(
      <PipelineProgress
        status="failed"
        failedStage="indexing"
        failedError="Transcription service unavailable"
      />,
    );

    // Red circle for failed stage
    const redCircles = container.querySelectorAll(".bg-red-500, .bg-red-600");
    expect(redCircles.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Transcription service unavailable/)).toBeInTheDocument();
  });

  it("renders pending stages as gray dots", () => {
    const { container } = render(<PipelineProgress status="uploading" />);

    // Gray dots for pending stages
    const grayDots = container.querySelectorAll(".bg-slate-300, .bg-slate-600");
    expect(grayDots.length).toBeGreaterThanOrEqual(2);
  });
});
