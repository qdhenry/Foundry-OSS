import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FindingCard, type FindingData } from "./FindingCard";

const baseFinding: FindingData = {
  _id: "f-1",
  type: "requirement",
  status: "pending",
  data: {
    title: "Tax Calculation",
    description:
      "Implement tax calculation for multi-state compliance covering all US states and territories with automated rate lookups and validation",
  },
  confidence: "high",
  suggestedWorkstream: "Commerce",
  sourceExcerpt: "The system must calculate taxes based on destination...",
  documentName: "requirements.pdf",
};

describe("FindingCard", () => {
  const defaultProps = {
    finding: baseFinding,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onEdit: vi.fn(),
  };

  it("renders finding title from data", () => {
    render(<FindingCard {...defaultProps} />);
    expect(screen.getByText("Tax Calculation")).toBeInTheDocument();
  });

  it("renders type badge", () => {
    render(<FindingCard {...defaultProps} />);
    expect(screen.getByText("Requirement")).toBeInTheDocument();
  });

  it("renders confidence badge", () => {
    render(<FindingCard {...defaultProps} />);
    // "High" confidence badge
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
  });

  it("renders suggested workstream", () => {
    render(<FindingCard {...defaultProps} />);
    expect(screen.getByText("Commerce")).toBeInTheDocument();
  });

  it("renders source excerpt", () => {
    render(<FindingCard {...defaultProps} />);
    expect(screen.getByText(/must calculate taxes/)).toBeInTheDocument();
  });

  it("shows action buttons for pending findings", () => {
    render(<FindingCard {...defaultProps} />);
    expect(screen.getByLabelText("Approve finding: Tax Calculation")).toBeInTheDocument();
    expect(screen.getByLabelText("Reject finding: Tax Calculation")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit finding: Tax Calculation")).toBeInTheDocument();
  });

  it("calls onApprove when Approve clicked", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(<FindingCard {...defaultProps} onApprove={onApprove} />);
    await user.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("f-1");
  });

  it("calls onReject when Reject clicked", async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    render(<FindingCard {...defaultProps} onReject={onReject} />);
    await user.click(screen.getByText("Reject"));
    expect(onReject).toHaveBeenCalledWith("f-1");
  });

  it("calls onEdit when Edit clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<FindingCard {...defaultProps} onEdit={onEdit} />);
    await user.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith("f-1");
  });

  it("hides action buttons for approved findings", () => {
    const finding = { ...baseFinding, status: "approved" as const };
    render(<FindingCard {...defaultProps} finding={finding} />);
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();
  });

  it("shows Show more button for long descriptions", async () => {
    const user = userEvent.setup();
    render(<FindingCard {...defaultProps} />);
    const showMore = screen.getByText("Show more");
    expect(showMore).toBeInTheDocument();
    await user.click(showMore);
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("uses editedData over data when available", () => {
    const finding = {
      ...baseFinding,
      editedData: { title: "Edited Tax Calc", description: "Updated description" },
    };
    render(<FindingCard {...defaultProps} finding={finding} />);
    expect(screen.getByText("Edited Tax Calc")).toBeInTheDocument();
  });

  it("renders risk type badge", () => {
    const finding = { ...baseFinding, type: "risk" as const };
    render(<FindingCard {...defaultProps} finding={finding} />);
    expect(screen.getByText("Risk")).toBeInTheDocument();
  });
});
