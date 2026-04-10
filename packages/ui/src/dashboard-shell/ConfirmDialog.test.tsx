import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    isOpen: true,
    title: "Delete document",
    description: "This will permanently remove the document and its analysis results.",
    confirmLabel: "Delete",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when closed", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and description when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Delete document")).toBeInTheDocument();
    expect(screen.getByText(/permanently remove/)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Escape is pressed", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses destructive styling for confirm button", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmButton = screen.getByText("Delete");
    expect(confirmButton.className).toContain("bg-status-error");
  });

  it("disables buttons when busy", () => {
    render(<ConfirmDialog {...defaultProps} busy />);
    expect(screen.getByText("Cancel")).toBeDisabled();
    // busy=true should show "Deleting..." text
    expect(screen.getByText("Deleting...")).toBeDisabled();
  });
});
