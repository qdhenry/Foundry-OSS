import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RiskFilters } from "./RiskFilters";

describe("RiskFilters", () => {
  const defaultProps = {
    severity: "" as const,
    status: "" as const,
    onSeverityChange: vi.fn(),
    onStatusChange: vi.fn(),
  };

  it("renders severity and status dropdowns", () => {
    render(<RiskFilters {...defaultProps} />);
    expect(screen.getByText("All Severities")).toBeInTheDocument();
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("renders severity options", () => {
    render(<RiskFilters {...defaultProps} />);
    const severitySelect = screen.getByDisplayValue("All Severities");
    expect(severitySelect).toBeInTheDocument();
  });

  it("calls onSeverityChange when severity is selected", async () => {
    const onSeverityChange = vi.fn();
    const user = userEvent.setup();
    render(<RiskFilters {...defaultProps} onSeverityChange={onSeverityChange} />);
    const select = screen.getAllByRole("combobox")[0];
    await user.selectOptions(select, "critical");
    expect(onSeverityChange).toHaveBeenCalledWith("critical");
  });

  it("calls onStatusChange when status is selected", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    render(<RiskFilters {...defaultProps} onStatusChange={onStatusChange} />);
    const select = screen.getAllByRole("combobox")[1];
    await user.selectOptions(select, "resolved");
    expect(onStatusChange).toHaveBeenCalledWith("resolved");
  });

  it("does not show Clear filters when no filters active", () => {
    render(<RiskFilters {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).toBeNull();
  });

  it("shows Clear filters button when filters are active", () => {
    render(<RiskFilters {...defaultProps} severity="high" />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("clears both filters on Clear filters click", async () => {
    const onSeverityChange = vi.fn();
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RiskFilters
        {...defaultProps}
        severity="high"
        status="open"
        onSeverityChange={onSeverityChange}
        onStatusChange={onStatusChange}
      />,
    );
    await user.click(screen.getByText("Clear filters"));
    expect(onSeverityChange).toHaveBeenCalledWith("");
    expect(onStatusChange).toHaveBeenCalledWith("");
  });
});
