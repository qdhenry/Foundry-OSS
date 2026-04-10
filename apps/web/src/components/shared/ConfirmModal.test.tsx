import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";

vi.mock("@untitledui/icons", () => ({
  AlertTriangle: (props: any) => <span data-testid="alert-icon" {...props} />,
}));

vi.mock("@/components/application/modals/modal", () => ({
  Dialog: ({ children }: any) => <div data-testid="dialog">{children}</div>,
  DialogTrigger: ({ children, isOpen }: any) =>
    isOpen ? <div data-testid="dialog-trigger">{children}</div> : null,
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalOverlay: ({ children }: any) => <div data-testid="modal-overlay">{children}</div>,
}));

describe("ConfirmModal", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="Are you sure?"
      />,
    );
    expect(screen.queryByText("Delete Item")).not.toBeInTheDocument();
  });

  it("renders title and description when open", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="This action cannot be undone."
      />,
    );
    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("renders confirm and cancel buttons with default labels", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm"
        description="Proceed?"
      />,
    );
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Remove"
        description="Remove this?"
        confirmLabel="Yes, Remove"
        cancelLabel="Keep It"
      />,
    );
    expect(screen.getByText("Yes, Remove")).toBeInTheDocument();
    expect(screen.getByText("Keep It")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Delete"
        description="Sure?"
      />,
    );
    await user.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Delete"
        description="Sure?"
      />,
    );
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
