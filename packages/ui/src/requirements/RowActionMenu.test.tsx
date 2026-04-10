import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RowActionMenu } from "./RowActionMenu";

describe("RowActionMenu", () => {
  const defaultProps = {
    requirementId: "req-1",
    currentStatus: "draft" as const,
    onEdit: vi.fn(),
    onViewDetails: vi.fn(),
    onStatusChange: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders three-dot button", () => {
    render(<RowActionMenu {...defaultProps} />);

    const button = screen.getByRole("button", {
      name: /Actions for requirement req-1/,
    });
    expect(button).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const user = userEvent.setup();
    render(<RowActionMenu {...defaultProps} />);

    const button = screen.getByRole("button", {
      name: /Actions for requirement req-1/,
    });
    await user.click(button);

    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Change Status")).toBeInTheDocument();
    expect(screen.getByText("View Details")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onEdit when Edit is clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<RowActionMenu {...defaultProps} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: /Actions for requirement/ }));
    await user.click(screen.getByText("Edit"));

    expect(onEdit).toHaveBeenCalled();
  });

  it("calls onViewDetails when View Details is clicked", async () => {
    const onViewDetails = vi.fn();
    const user = userEvent.setup();
    render(<RowActionMenu {...defaultProps} onViewDetails={onViewDetails} />);

    await user.click(screen.getByRole("button", { name: /Actions for requirement/ }));
    await user.click(screen.getByText("View Details"));

    expect(onViewDetails).toHaveBeenCalled();
  });

  it("calls onDelete when Delete is clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<RowActionMenu {...defaultProps} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /Actions for requirement/ }));
    await user.click(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalled();
  });

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup();
    render(<RowActionMenu {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /Actions for requirement/ }));
    expect(screen.getByText("Edit")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Edit")).toBeNull();
  });
});
