import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisProgress } from "./AnalysisProgress";

describe("AnalysisProgress", () => {
  it("renders 5 stage labels", () => {
    render(<AnalysisProgress status="scanning" />);
    expect(screen.getByText("Scan")).toBeInTheDocument();
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByText("Tour")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("shows stage description for active stage", () => {
    render(<AnalysisProgress status="analyzing" />);
    expect(screen.getByText("Analyzing code patterns and dependencies")).toBeInTheDocument();
  });

  it("shows completion message", () => {
    render(<AnalysisProgress status="completed" />);
    expect(screen.getByText("Analysis complete")).toBeInTheDocument();
  });

  it("shows failed message", () => {
    render(<AnalysisProgress status="failed" />);
    expect(screen.getByText("Analysis failed")).toBeInTheDocument();
  });

  it("uses currentStage override", () => {
    render(<AnalysisProgress status="analyzing" currentStage="mapping" />);
    expect(screen.getByText("Building knowledge graph relationships")).toBeInTheDocument();
  });
});
