import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

describe("DeleteConfirmModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isDeleting: false,
    count: 1,
  };

  it("renders nothing when not open", () => {
    render(<DeleteConfirmModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows singular message for count=1", () => {
    render(<DeleteConfirmModal {...defaultProps} count={1} />);
    expect(screen.getByText("Delete Requirement?")).toBeInTheDocument();
  });

  it("shows plural message for count > 1", () => {
    render(<DeleteConfirmModal {...defaultProps} count={5} />);
    expect(screen.getByText("Delete 5 Requirements?")).toBeInTheDocument();
  });

  it("calls onConfirm when delete button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<DeleteConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    // The confirm button shows "Delete" text when not deleting
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((btn) => btn.textContent === "Delete");
    expect(deleteButton).toBeDefined();
    await user.click(deleteButton!);

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DeleteConfirmModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
  });

  it("disables buttons when isDeleting is true", () => {
    render(<DeleteConfirmModal {...defaultProps} isDeleting={true} />);

    const cancelButton = screen.getByText("Cancel");
    expect(cancelButton).toBeDisabled();

    expect(screen.getByText("Deleting...")).toBeInTheDocument();

    // The delete/confirm button should also be disabled
    const deletingButton = screen.getByText("Deleting...").closest("button");
    expect(deletingButton).toBeDisabled();
  });
});
