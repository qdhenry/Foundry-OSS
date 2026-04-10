import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewStep } from "./ReviewStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockFindings: any[] | undefined;
const mockReviewFinding = vi.fn();
const mockBulkReview = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockFindings,
  useMutation: (fnRef: string) => {
    if (fnRef === "discoveryFindings:reviewFinding") return mockReviewFinding;
    if (fnRef === "discoveryFindings:bulkReviewFindings") return mockBulkReview;
    return vi.fn();
  },
  useAction: () => vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    discoveryFindings: {
      listByProgram: "discoveryFindings:listByProgram",
      reviewFinding: "discoveryFindings:reviewFinding",
      bulkReviewFindings: "discoveryFindings:bulkReviewFindings",
    },
  },
}));

vi.mock("../../../../convex/_generated/dataModel", () => ({}));

const mockOnNext = vi.fn();
const mockOnBack = vi.fn();

const defaultProps = {
  programId: "prog-1",
  onNext: mockOnNext,
  onBack: mockOnBack,
};

beforeEach(() => {
  mockFindings = undefined;
  mockOnNext.mockClear();
  mockOnBack.mockClear();
  mockReviewFinding.mockClear();
  mockBulkReview.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides: Record<string, unknown> = {}) {
  return {
    _id: "finding-1",
    type: "requirement",
    status: "pending",
    confidence: "high",
    data: { title: "Test Finding" },
    editedData: null,
    sourceExcerpt: "Some excerpt from the document",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReviewStep", () => {
  it("renders heading and loading state when findings undefined", () => {
    mockFindings = undefined;

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("Review Findings")).toBeInTheDocument();
    expect(screen.getByText("Loading findings...")).toBeInTheDocument();
  });

  it("renders empty state when no findings for the active tab", () => {
    mockFindings = [];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("No requirement findings extracted.")).toBeInTheDocument();
  });

  it("renders all finding tabs with correct labels", () => {
    mockFindings = [];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();
    expect(screen.getByText("Action Items")).toBeInTheDocument();
  });

  it("shows tab counts when findings exist", () => {
    mockFindings = [
      makeFinding({ _id: "f1", type: "requirement" }),
      makeFinding({ _id: "f2", type: "requirement" }),
      makeFinding({ _id: "f3", type: "risk" }),
    ];

    render(<ReviewStep {...defaultProps} />);

    // Requirements tab should show count 2
    const reqTab = screen.getByText("Requirements").closest("button")!;
    expect(reqTab.textContent).toContain("2");
  });

  it("displays finding title, confidence, and status badges", () => {
    mockFindings = [
      makeFinding({
        _id: "f1",
        type: "requirement",
        confidence: "high",
        status: "pending",
        data: { title: "Payment Gateway Integration" },
        sourceExcerpt: "Must support Stripe and PayPal",
      }),
    ];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("Payment Gateway Integration")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("Must support Stripe and PayPal")).toBeInTheDocument();
  });

  it("uses editedData.title over data.title when available", () => {
    mockFindings = [
      makeFinding({
        _id: "f1",
        type: "requirement",
        data: { title: "Original Title" },
        editedData: { title: "Edited Title" },
      }),
    ];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("Edited Title")).toBeInTheDocument();
    expect(screen.queryByText("Original Title")).not.toBeInTheDocument();
  });

  it("falls back to data.name when data.title is missing", () => {
    mockFindings = [
      makeFinding({
        _id: "f1",
        type: "requirement",
        data: { name: "Named Finding" },
      }),
    ];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("Named Finding")).toBeInTheDocument();
  });

  it("shows 'Untitled' when no title or name", () => {
    mockFindings = [
      makeFinding({
        _id: "f1",
        type: "requirement",
        data: { description: "just a description" },
      }),
    ];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("shows approve/reject buttons for pending findings", () => {
    mockFindings = [makeFinding({ _id: "f1", type: "requirement", status: "pending" })];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByTitle("Approve")).toBeInTheDocument();
    expect(screen.getByTitle("Reject")).toBeInTheDocument();
  });

  it("does not show approve/reject buttons for already reviewed findings", () => {
    mockFindings = [makeFinding({ _id: "f1", type: "requirement", status: "approved" })];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.queryByTitle("Approve")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Reject")).not.toBeInTheDocument();
  });

  it("switches tabs to show different finding types", () => {
    mockFindings = [
      makeFinding({
        _id: "f1",
        type: "requirement",
        data: { title: "Req Finding" },
      }),
      makeFinding({
        _id: "f2",
        type: "risk",
        data: { title: "Risk Finding" },
      }),
    ];

    render(<ReviewStep {...defaultProps} />);

    // Initially on Requirements tab
    expect(screen.getByText("Req Finding")).toBeInTheDocument();
    expect(screen.queryByText("Risk Finding")).not.toBeInTheDocument();

    // Switch to Risks tab
    fireEvent.click(screen.getByText("Risks"));
    expect(screen.getByText("Risk Finding")).toBeInTheDocument();
    expect(screen.queryByText("Req Finding")).not.toBeInTheDocument();
  });

  it("renders attribution metadata and action items", () => {
    mockFindings = [
      makeFinding({
        _id: "f1",
        type: "action_item",
        data: { title: "Follow up with legal" },
        sourceAttribution: {
          sourceTimestamp: 65000,
          sourceSpeaker: { speakerId: "spk_1", name: "Alex" },
          sourceKeyframeUrls: ["https://example.com/frame.jpg"],
        },
      }),
    ];

    render(<ReviewStep {...defaultProps} />);

    fireEvent.click(screen.getByText("Action Items"));
    expect(screen.getByText("Follow up with legal")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keyframe" })).toHaveAttribute(
      "href",
      "https://example.com/frame.jpg",
    );
  });

  it("shows summary stats", () => {
    mockFindings = [
      makeFinding({ _id: "f1", status: "approved" }),
      makeFinding({ _id: "f2", status: "rejected" }),
      makeFinding({ _id: "f3", status: "pending" }),
      makeFinding({ _id: "f4", status: "edited" }),
    ];

    render(<ReviewStep {...defaultProps} />);

    // Summary stats with approved/rejected/pending breakdowns
    expect(screen.getByText("2 approved")).toBeInTheDocument();
    expect(screen.getByText("1 rejected")).toBeInTheDocument();
    expect(screen.getByText("1 pending")).toBeInTheDocument();
  });

  it("shows bulk action buttons when pending findings exist in active tab", () => {
    mockFindings = [
      makeFinding({ _id: "f1", type: "requirement", status: "pending" }),
      makeFinding({ _id: "f2", type: "requirement", status: "pending" }),
    ];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.getByText("2 pending:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve All Requirements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject All Requirements" })).toBeInTheDocument();
  });

  it("does not show bulk actions when no pending findings in active tab", () => {
    mockFindings = [makeFinding({ _id: "f1", type: "requirement", status: "approved" })];

    render(<ReviewStep {...defaultProps} />);

    expect(screen.queryByRole("button", { name: "Approve All" })).not.toBeInTheDocument();
  });

  it("Back button calls onBack", () => {
    mockFindings = [];

    render(<ReviewStep {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mockOnBack).toHaveBeenCalledOnce();
  });

  it("Next button calls onNext", () => {
    mockFindings = [];

    render(<ReviewStep {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mockOnNext).toHaveBeenCalledOnce();
  });
});
