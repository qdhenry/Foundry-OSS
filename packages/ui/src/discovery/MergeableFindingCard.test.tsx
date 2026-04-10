import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../theme/useAnimations", () => ({
  useSlideReveal: vi.fn(),
}));

import { MergeableFindingCard } from "./MergeableFindingCard";

describe("MergeableFindingCard", () => {
  const baseFinding = {
    _id: "f1",
    type: "requirement",
    confidence: "high",
    status: "pending",
    data: { title: "Cart Migration", description: "Migrate shopping cart data" },
  };

  const defaultProps = {
    finding: baseFinding,
    requirements: [],
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onMerge: vi.fn(),
  };

  it("renders finding title and description", () => {
    render(<MergeableFindingCard {...defaultProps} />);
    expect(screen.getByText("Cart Migration")).toBeInTheDocument();
    expect(screen.getByText("Migrate shopping cart data")).toBeInTheDocument();
  });

  it("renders type, confidence, and status badges", () => {
    render(<MergeableFindingCard {...defaultProps} />);
    expect(screen.getByText("requirement")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("shows document name when provided", () => {
    render(
      <MergeableFindingCard
        {...defaultProps}
        finding={{ ...baseFinding, documentName: "gap_analysis.pdf" }}
      />,
    );
    expect(screen.getByText("gap_analysis.pdf")).toBeInTheDocument();
  });

  it("shows Approve and Reject buttons for pending findings", () => {
    render(<MergeableFindingCard {...defaultProps} />);
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("hides action buttons for non-pending findings", () => {
    render(
      <MergeableFindingCard {...defaultProps} finding={{ ...baseFinding, status: "approved" }} />,
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });

  it("calls onApprove with finding id", () => {
    const onApprove = vi.fn();
    render(<MergeableFindingCard {...defaultProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("f1");
  });

  it("calls onReject with finding id", () => {
    const onReject = vi.fn();
    render(<MergeableFindingCard {...defaultProps} onReject={onReject} />);
    fireEvent.click(screen.getByText("Reject"));
    expect(onReject).toHaveBeenCalledWith("f1");
  });

  it("shows Merged badge when isMerged is true", () => {
    render(
      <MergeableFindingCard
        {...defaultProps}
        finding={{ ...baseFinding, status: "approved" }}
        isMerged
      />,
    );
    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("shows potential match notice when data contains potentialMatch", () => {
    render(
      <MergeableFindingCard
        {...defaultProps}
        finding={{
          ...baseFinding,
          data: { ...baseFinding.data, potentialMatch: "Existing Req" },
        }}
      />,
    );
    expect(screen.getByText(/Potential match:/)).toBeInTheDocument();
    expect(screen.getByText("Existing Req")).toBeInTheDocument();
    expect(screen.getByText("Merge into existing")).toBeInTheDocument();
  });

  it("renders source excerpt blockquote when provided", () => {
    render(
      <MergeableFindingCard
        {...defaultProps}
        finding={{ ...baseFinding, sourceExcerpt: "Section 3.2 of the document..." }}
      />,
    );
    expect(screen.getByText("Section 3.2 of the document...")).toBeInTheDocument();
  });

  it("disables buttons when isBusy", () => {
    render(<MergeableFindingCard {...defaultProps} isBusy />);
    expect(screen.getByText("Approve")).toBeDisabled();
    expect(screen.getByText("Reject")).toBeDisabled();
  });
});
