import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationFilters } from "./IntegrationFilters";

describe("IntegrationFilters", () => {
  it("renders type and status dropdowns", () => {
    render(<IntegrationFilters filters={{}} onFilterChange={vi.fn()} />);
    expect(screen.getByText("All Types")).toBeInTheDocument();
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("calls onFilterChange when type is selected", () => {
    const onFilterChange = vi.fn();
    render(<IntegrationFilters filters={{}} onFilterChange={onFilterChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "api" } });
    expect(onFilterChange).toHaveBeenCalledWith({ type: "api" });
  });

  it("calls onFilterChange when status is selected", () => {
    const onFilterChange = vi.fn();
    render(<IntegrationFilters filters={{}} onFilterChange={onFilterChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "live" } });
    expect(onFilterChange).toHaveBeenCalledWith({ status: "live" });
  });

  it("shows clear button when filters are active", () => {
    render(<IntegrationFilters filters={{ type: "api" }} onFilterChange={vi.fn()} />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("does not show clear button when no filters active", () => {
    render(<IntegrationFilters filters={{}} onFilterChange={vi.fn()} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("clears all filters when clear button clicked", () => {
    const onFilterChange = vi.fn();
    render(
      <IntegrationFilters
        filters={{ type: "api", status: "live" }}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(screen.getByText("Clear filters"));
    expect(onFilterChange).toHaveBeenCalledWith({});
  });

  it("preserves existing filters when changing one", () => {
    const onFilterChange = vi.fn();
    render(<IntegrationFilters filters={{ type: "api" }} onFilterChange={onFilterChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "testing" } });
    expect(onFilterChange).toHaveBeenCalledWith({ type: "api", status: "testing" });
  });
});
