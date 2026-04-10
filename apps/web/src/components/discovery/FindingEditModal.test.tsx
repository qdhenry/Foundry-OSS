import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingEditModal } from "./FindingEditModal";

const requirementFinding = {
  _id: "finding-1",
  type: "requirement" as const,
  status: "pending" as const,
  data: { title: "Test Req", description: "A description", priority: "must_have" },
  confidence: "high" as const,
};

describe("FindingEditModal", () => {
  const defaultProps = {
    finding: requirementFinding,
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  it("renders nothing when isOpen is false", () => {
    const { container } = render(<FindingEditModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when finding is null", () => {
    const { container } = render(<FindingEditModal {...defaultProps} finding={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal header", () => {
    render(<FindingEditModal {...defaultProps} />);
    expect(screen.getByText("Edit Finding")).toBeInTheDocument();
  });

  it("renders requirement fields for requirement type", () => {
    render(<FindingEditModal {...defaultProps} />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Fit/Gap")).toBeInTheDocument();
  });

  it("renders risk fields for risk type", () => {
    render(
      <FindingEditModal
        {...defaultProps}
        finding={{
          ...requirementFinding,
          type: "risk",
          data: { title: "Risk", severity: "high" },
        }}
      />,
    );
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("Probability")).toBeInTheDocument();
    expect(screen.getByText("Mitigation")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<FindingEditModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onSave and onClose when Save is clicked", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<FindingEditModal {...defaultProps} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("finding-1", expect.any(Object));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
