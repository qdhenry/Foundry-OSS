import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisconnectGoogleDriveDialog } from "./DisconnectGoogleDriveDialog";

describe("DisconnectGoogleDriveDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <DisconnectGoogleDriveDialog
        isOpen={false}
        email="user@gmail.com"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the email address in the description", () => {
    render(
      <DisconnectGoogleDriveDialog
        isOpen
        email="user@gmail.com"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/user@gmail\.com/)).toBeInTheDocument();
  });

  it("calls onConfirm when Disconnect button is clicked", () => {
    render(
      <DisconnectGoogleDriveDialog
        isOpen
        email="user@gmail.com"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Disconnect"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Keep connected button is clicked", () => {
    render(
      <DisconnectGoogleDriveDialog
        isOpen
        email="user@gmail.com"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Keep connected"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
