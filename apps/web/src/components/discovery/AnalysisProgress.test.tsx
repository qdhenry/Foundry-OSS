import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisProgress } from "./AnalysisProgress";

let mockProgress: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockProgress,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { documentAnalysis: { getBatchProgress: "documentAnalysis:getBatchProgress" } },
}));

describe("AnalysisProgress", () => {
  it("renders loading skeleton when data is undefined", () => {
    mockProgress = undefined;
    const { container } = render(<AnalysisProgress programId="prog-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders empty message when no documents", () => {
    mockProgress = [];
    render(<AnalysisProgress programId="prog-1" />);
    expect(screen.getByText("No documents are being analyzed")).toBeInTheDocument();
  });

  it("renders progress header with count", () => {
    mockProgress = [
      { analysisId: "a1", documentName: "spec.pdf", status: "complete" },
      { analysisId: "a2", documentName: "reqs.docx", status: "analyzing" },
    ];
    render(<AnalysisProgress programId="prog-1" />);
    expect(screen.getByText("Analysis Progress")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 documents analyzed")).toBeInTheDocument();
  });

  it("renders document names and status labels", () => {
    mockProgress = [
      { analysisId: "a1", documentName: "spec.pdf", status: "complete" },
      { analysisId: "a2", documentName: "reqs.docx", status: "queued" },
    ];
    render(<AnalysisProgress programId="prog-1" />);
    expect(screen.getByText("spec.pdf")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("reqs.docx")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });
});
