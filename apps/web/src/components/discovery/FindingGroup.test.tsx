import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FindingData } from "./FindingCard";
import { FindingGroup } from "./FindingGroup";

const makeFinding = (overrides: Partial<FindingData> = {}): FindingData => ({
  _id: "finding-1",
  type: "requirement",
  status: "pending",
  data: { title: "Test Finding", description: "A test" },
  confidence: "high",
  ...overrides,
});

describe("FindingGroup", () => {
  const baseProps = {
    type: "requirement" as const,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onEdit: vi.fn(),
    onBulkApprove: vi.fn(),
    onBulkReject: vi.fn(),
  };

  it("renders empty state when no findings", () => {
    render(<FindingGroup {...baseProps} findings={[]} />);
    expect(screen.getByText("No requirements found")).toBeInTheDocument();
  });

  it("renders group header with label and count", () => {
    const findings = [makeFinding()];
    render(<FindingGroup {...baseProps} findings={findings} />);
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows bulk actions for pending findings", () => {
    const findings = [makeFinding({ _id: "f-1" }), makeFinding({ _id: "f-2" })];
    render(<FindingGroup {...baseProps} findings={findings} />);
    expect(screen.getByText("Approve All (2)")).toBeInTheDocument();
    expect(screen.getByText("Reject All (2)")).toBeInTheDocument();
  });

  it("hides bulk actions when no pending findings", () => {
    const findings = [makeFinding({ status: "approved" })];
    render(<FindingGroup {...baseProps} findings={findings} />);
    expect(screen.queryByText(/Approve All/)).not.toBeInTheDocument();
  });

  it("calls onBulkApprove with pending IDs", () => {
    const onBulkApprove = vi.fn();
    const findings = [
      makeFinding({ _id: "f-1", status: "pending" }),
      makeFinding({ _id: "f-2", status: "approved" }),
    ];
    render(<FindingGroup {...baseProps} findings={findings} onBulkApprove={onBulkApprove} />);
    fireEvent.click(screen.getByText("Approve All (1)"));
    expect(onBulkApprove).toHaveBeenCalledWith(["f-1"]);
  });

  it("renders correct header for risk type", () => {
    render(<FindingGroup {...baseProps} type="risk" findings={[makeFinding()]} />);
    expect(screen.getByText("Risks")).toBeInTheDocument();
  });
});
