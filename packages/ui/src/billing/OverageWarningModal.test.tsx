import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverageWarningModal } from "./OverageWarningModal";

describe("OverageWarningModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onContinue: vi.fn(),
    onUpgrade: vi.fn(),
    overageRate: 2.5,
    currentOverageCount: 3,
  };

  it("renders nothing when not open", () => {
    const { container } = render(<OverageWarningModal {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders overage session heading when open", () => {
    render(<OverageWarningModal {...defaultProps} />);
    expect(screen.getByText("Overage Session")).toBeInTheDocument();
  });

  it("displays the overage rate", () => {
    render(<OverageWarningModal {...defaultProps} />);
    expect(screen.getByText("$2.50")).toBeInTheDocument();
  });

  it("displays overage count", () => {
    render(<OverageWarningModal {...defaultProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onUpgrade when Upgrade Plan clicked", () => {
    const onUpgrade = vi.fn();
    render(<OverageWarningModal {...defaultProps} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByText("Upgrade Plan"));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it("calls onContinue when Continue clicked", () => {
    const onContinue = vi.fn();
    render(<OverageWarningModal {...defaultProps} onContinue={onContinue} />);
    fireEvent.click(screen.getByText("Continue"));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<OverageWarningModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close modal"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the dont-show-again checkbox", () => {
    render(<OverageWarningModal {...defaultProps} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
