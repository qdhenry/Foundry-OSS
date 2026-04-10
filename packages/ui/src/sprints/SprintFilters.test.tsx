import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SprintFilters } from "./SprintFilters";

describe("SprintFilters", () => {
  const defaultProps = {
    workstreams: [
      { _id: "ws-1", name: "Auth Module" },
      { _id: "ws-2", name: "Billing" },
    ],
    workstreamFilter: "",
    onWorkstreamFilterChange: vi.fn(),
    statusFilter: "",
    onStatusFilterChange: vi.fn(),
  };

  it("renders All Workstreams option", () => {
    render(<SprintFilters {...defaultProps} />);
    expect(screen.getByText("All Workstreams")).toBeInTheDocument();
  });

  it("renders workstream options", () => {
    render(<SprintFilters {...defaultProps} />);
    expect(screen.getByText("Auth Module")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it("renders status filter options", () => {
    render(<SprintFilters {...defaultProps} />);
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("calls onWorkstreamFilterChange when workstream selected", async () => {
    const onChange = vi.fn();
    render(<SprintFilters {...defaultProps} onWorkstreamFilterChange={onChange} />);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "ws-1");
    expect(onChange).toHaveBeenCalledWith("ws-1");
  });

  it("calls onStatusFilterChange when status selected", async () => {
    const onChange = vi.fn();
    render(<SprintFilters {...defaultProps} onStatusFilterChange={onChange} />);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "active");
    expect(onChange).toHaveBeenCalledWith("active");
  });
});
