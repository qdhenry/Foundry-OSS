import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SprintFilters } from "./SprintFilters";

describe("SprintFilters", () => {
  const defaultProps = {
    workstreams: [
      { _id: "ws-1", name: "Commerce" },
      { _id: "ws-2", name: "Content" },
    ],
    workstreamFilter: "",
    onWorkstreamFilterChange: vi.fn(),
    statusFilter: "",
    onStatusFilterChange: vi.fn(),
  };

  it("renders workstream and status dropdowns", () => {
    render(<SprintFilters {...defaultProps} />);
    expect(screen.getByText("All Workstreams")).toBeInTheDocument();
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("renders workstream options", () => {
    render(<SprintFilters {...defaultProps} />);
    expect(screen.getByText("Commerce")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("calls onWorkstreamFilterChange on selection", async () => {
    const onWorkstreamFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<SprintFilters {...defaultProps} onWorkstreamFilterChange={onWorkstreamFilterChange} />);
    await user.selectOptions(screen.getAllByRole("combobox")[0], "ws-1");
    expect(onWorkstreamFilterChange).toHaveBeenCalledWith("ws-1");
  });

  it("calls onStatusFilterChange on selection", async () => {
    const onStatusFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<SprintFilters {...defaultProps} onStatusFilterChange={onStatusFilterChange} />);
    await user.selectOptions(screen.getAllByRole("combobox")[1], "active");
    expect(onStatusFilterChange).toHaveBeenCalledWith("active");
  });

  it("renders all status options", () => {
    render(<SprintFilters {...defaultProps} />);
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
