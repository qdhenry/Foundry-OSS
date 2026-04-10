import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisStep } from "./AnalysisStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockProgress: any[] | undefined;
const mockOnNext = vi.fn();
const mockOnBack = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
  useQuery: () => mockProgress,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    documentAnalysis: {
      getBatchProgress: "documentAnalysis:getBatchProgress",
    },
  },
}));

vi.mock("../../../../convex/_generated/dataModel", () => ({
  // No-op — Id is just used as a type cast
}));

beforeEach(() => {
  mockProgress = undefined;
  mockOnNext.mockClear();
  mockOnBack.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const defaultProps = {
  programId: "prog-1",
  onNext: mockOnNext,
  onBack: mockOnBack,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnalysisStep", () => {
  it("renders heading and loading message when progress is undefined", () => {
    mockProgress = undefined;

    render(<AnalysisStep {...defaultProps} />);

    expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    expect(screen.getByText("Loading analysis status...")).toBeInTheDocument();
  });

  it("shows empty state when progress is an empty array", () => {
    mockProgress = [];

    render(<AnalysisStep {...defaultProps} />);

    expect(screen.getByText("No documents to analyze.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip to Review" })).toBeInTheDocument();
  });

  it("shows progress bar and document list when documents are in progress", () => {
    mockProgress = [
      { analysisId: "a1", documentName: "gap-analysis.pdf", status: "complete" },
      { analysisId: "a2", documentName: "arch-doc.pdf", status: "analyzing" },
      { analysisId: "a3", documentName: "notes.pdf", status: "queued" },
    ];

    render(<AnalysisStep {...defaultProps} />);

    // Progress text
    expect(screen.getByText("33% complete")).toBeInTheDocument();
    expect(screen.getByText("1/3 documents")).toBeInTheDocument();

    // Document names
    expect(screen.getByText("gap-analysis.pdf")).toBeInTheDocument();
    expect(screen.getByText("arch-doc.pdf")).toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();

    // Status badges
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Analyzing")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("disables Next button while documents are still being analyzed", () => {
    mockProgress = [{ analysisId: "a1", documentName: "doc1.pdf", status: "analyzing" }];

    render(<AnalysisStep {...defaultProps} />);

    const nextBtn = screen.getByRole("button", { name: "Waiting..." });
    expect(nextBtn).toBeDisabled();
  });

  it("shows 'Continue to Review' when all documents are done", () => {
    mockProgress = [
      { analysisId: "a1", documentName: "doc1.pdf", status: "complete" },
      { analysisId: "a2", documentName: "doc2.pdf", status: "complete" },
    ];

    render(<AnalysisStep {...defaultProps} />);

    expect(screen.getByText("All documents analyzed! Moving to review...")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Continue to Review" });
    expect(nextBtn).not.toBeDisabled();
  });

  it("auto-advances after 1.5s when all done", () => {
    mockProgress = [{ analysisId: "a1", documentName: "doc1.pdf", status: "complete" }];

    render(<AnalysisStep {...defaultProps} />);

    expect(mockOnNext).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);

    expect(mockOnNext).toHaveBeenCalledOnce();
  });

  it("counts failed documents as completed for progress", () => {
    mockProgress = [
      { analysisId: "a1", documentName: "doc1.pdf", status: "complete" },
      { analysisId: "a2", documentName: "doc2.pdf", status: "failed" },
    ];

    render(<AnalysisStep {...defaultProps} />);

    // Both complete+failed count as completed
    expect(screen.getByText("100% complete")).toBeInTheDocument();
    expect(screen.getByText("2/2 documents")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("Back button calls onBack", () => {
    mockProgress = [];

    render(<AnalysisStep {...defaultProps} />);

    screen.getByRole("button", { name: "Back" }).click();
    expect(mockOnBack).toHaveBeenCalledOnce();
  });
});
