import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequirementFilters } from "./RequirementFilters";

describe("RequirementFilters", () => {
  const defaultProps = {
    filters: {},
    onFilterChange: vi.fn(),
    workstreams: [
      { _id: "ws-1", name: "Commerce" },
      { _id: "ws-2", name: "Content" },
    ],
    batches: ["Batch 1", "Batch 2"],
  };

  it("renders all filter labels", () => {
    render(<RequirementFilters {...defaultProps} />);
    expect(screen.getByText("Batch")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Workstream")).toBeInTheDocument();
  });

  it("renders batch options", () => {
    render(<RequirementFilters {...defaultProps} />);
    expect(screen.getByText("All Batches")).toBeInTheDocument();
    expect(screen.getByText("Batch 1")).toBeInTheDocument();
    expect(screen.getByText("Batch 2")).toBeInTheDocument();
  });

  it("renders priority options", () => {
    render(<RequirementFilters {...defaultProps} />);
    expect(screen.getByText("All Priorities")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Should Have")).toBeInTheDocument();
  });

  it("renders status options", () => {
    render(<RequirementFilters {...defaultProps} />);
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("calls onFilterChange when priority changes", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<RequirementFilters {...defaultProps} onFilterChange={onFilterChange} />);
    const selects = screen.getAllByRole("combobox");
    // Priority is the second select
    await user.selectOptions(selects[1], "must_have");
    expect(onFilterChange).toHaveBeenCalledWith({ priority: "must_have" });
  });

  it("does not show Clear filters when no active filters", () => {
    render(<RequirementFilters {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).toBeNull();
  });

  it("shows Clear filters when filters are active", () => {
    render(<RequirementFilters {...defaultProps} filters={{ priority: "must_have" }} />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("clears all filters on Clear click", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RequirementFilters
        {...defaultProps}
        filters={{ priority: "must_have", status: "draft" }}
        onFilterChange={onFilterChange}
      />,
    );
    await user.click(screen.getByText("Clear filters"));
    expect(onFilterChange).toHaveBeenCalledWith({});
  });
});
