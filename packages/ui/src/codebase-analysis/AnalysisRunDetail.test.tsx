import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisRunDetail } from "./AnalysisRunDetail";

let queryReturn: any;
vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

vi.mock("./ImplementationBadge", () => ({
  ImplementationBadge: () => <span data-testid="impl-badge">Badge</span>,
}));

describe("AnalysisRunDetail", () => {
  it("shows no results message when empty", () => {
    queryReturn = [];
    render(<AnalysisRunDetail runId="run-1" />);
    expect(screen.getByText("No results yet.")).toBeInTheDocument();
  });

  it("renders result items", () => {
    queryReturn = [
      {
        _id: "r1",
        implementationStatus: "fully_implemented",
        confidence: 95,
        confidenceReasoning: "All tests pass",
        _creationTime: Date.now(),
        reviewStatus: "auto_applied",
      },
    ];
    render(<AnalysisRunDetail runId="run-1" />);
    expect(screen.getByText("All tests pass")).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("shows pending review badge", () => {
    queryReturn = [
      {
        _id: "r1",
        implementationStatus: "not_found",
        confidence: 30,
        confidenceReasoning: "No matching code",
        _creationTime: Date.now(),
        reviewStatus: "pending_review",
      },
    ];
    render(<AnalysisRunDetail runId="run-1" />);
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("shows regression badge", () => {
    queryReturn = [
      {
        _id: "r1",
        implementationStatus: "not_found",
        confidence: 20,
        confidenceReasoning: "Was found before",
        _creationTime: Date.now(),
        reviewStatus: "regression_flagged",
      },
    ];
    render(<AnalysisRunDetail runId="run-1" />);
    expect(screen.getByText("Regression")).toBeInTheDocument();
  });
});
