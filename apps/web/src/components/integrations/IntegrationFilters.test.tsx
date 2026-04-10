import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntegrationFilters } from "./IntegrationFilters";

describe("IntegrationFilters", () => {
  it("renders type and status dropdowns", () => {
    render(<IntegrationFilters filters={{}} onFilterChange={vi.fn()} />);
    expect(screen.getByText("All Types")).toBeInTheDocument();
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("calls onFilterChange when type is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<IntegrationFilters filters={{}} onFilterChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "api");
    expect(onChange).toHaveBeenCalledWith({ type: "api" });
  });

  it("calls onFilterChange when status is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<IntegrationFilters filters={{}} onFilterChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "live");
    expect(onChange).toHaveBeenCalledWith({ status: "live" });
  });

  it("shows clear button when filters are active", () => {
    render(<IntegrationFilters filters={{ type: "api" }} onFilterChange={vi.fn()} />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("does not show clear button when no filters", () => {
    render(<IntegrationFilters filters={{}} onFilterChange={vi.fn()} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });
});
