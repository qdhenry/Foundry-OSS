import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MergeableFindingCard } from "./MergeableFindingCard";

const baseFinding = {
  _id: "finding-1",
  type: "requirement",
  status: "pending",
  confidence: "high",
  data: { title: "Test Requirement", description: "A test description" },
  editedData: null,
  documentName: "spec.pdf",
};

const baseRequirements = [
  { _id: "req-1", refId: "REQ-001", title: "Existing Requirement" },
  { _id: "req-2", refId: "REQ-002", title: "Another Requirement" },
];

describe("MergeableFindingCard", () => {
  const defaultProps = {
    finding: baseFinding,
    requirements: baseRequirements,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onMerge: vi.fn(),
  };

  it("renders finding title and description", () => {
    render(<MergeableFindingCard {...defaultProps} />);
    expect(screen.getByText("Test Requirement")).toBeInTheDocument();
    expect(screen.getByText("A test description")).toBeInTheDocument();
  });

  it("renders finding metadata badges", () => {
    render(<MergeableFindingCard {...defaultProps} />);
    expect(screen.getByText("requirement")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders document name", () => {
    render(<MergeableFindingCard {...defaultProps} />);
    expect(screen.getByText("spec.pdf")).toBeInTheDocument();
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

  it("calls onApprove with finding ID", () => {
    const onApprove = vi.fn();
    render(<MergeableFindingCard {...defaultProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("finding-1");
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

  it("shows potential match notice when data has potentialMatch", () => {
    render(
      <MergeableFindingCard
        {...defaultProps}
        finding={{
          ...baseFinding,
          data: { ...baseFinding.data, potentialMatch: "Existing Requirement" },
        }}
      />,
    );
    expect(screen.getByText(/Potential match:/)).toBeInTheDocument();
    expect(screen.getByText("Merge into existing")).toBeInTheDocument();
  });

  it("renders source excerpt as blockquote", () => {
    render(
      <MergeableFindingCard
        {...defaultProps}
        finding={{ ...baseFinding, sourceExcerpt: "Some excerpt text" }}
      />,
    );
    expect(screen.getByText("Some excerpt text")).toBeInTheDocument();
  });
});
