import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiskFilters } from "./RiskFilters";

describe("RiskFilters", () => {
  const defaultProps = {
    severity: "" as const,
    status: "" as const,
    onSeverityChange: vi.fn(),
    onStatusChange: vi.fn(),
  };

  it("renders severity dropdown with all options", () => {
    render(<RiskFilters {...defaultProps} />);
    expect(screen.getByText("All Severities")).toBeInTheDocument();
    const severitySelect = screen.getAllByRole("combobox")[0];
    expect(severitySelect).toBeInTheDocument();
  });

  it("renders status dropdown with all options", () => {
    render(<RiskFilters {...defaultProps} />);
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("does not show clear button when no filters active", () => {
    render(<RiskFilters {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("shows clear button when severity is set", () => {
    render(<RiskFilters {...defaultProps} severity="high" />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("shows clear button when status is set", () => {
    render(<RiskFilters {...defaultProps} status="open" />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("calls both callbacks on clear", () => {
    const onSeverityChange = vi.fn();
    const onStatusChange = vi.fn();
    render(
      <RiskFilters
        severity="high"
        status="open"
        onSeverityChange={onSeverityChange}
        onStatusChange={onStatusChange}
      />,
    );
    fireEvent.click(screen.getByText("Clear filters"));
    expect(onSeverityChange).toHaveBeenCalledWith("");
    expect(onStatusChange).toHaveBeenCalledWith("");
  });

  it("calls onSeverityChange when severity select changes", () => {
    const onSeverityChange = vi.fn();
    render(<RiskFilters {...defaultProps} onSeverityChange={onSeverityChange} />);
    const severitySelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(severitySelect, { target: { value: "critical" } });
    expect(onSeverityChange).toHaveBeenCalledWith("critical");
  });

  it("calls onStatusChange when status select changes", () => {
    const onStatusChange = vi.fn();
    render(<RiskFilters {...defaultProps} onStatusChange={onStatusChange} />);
    const statusSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(statusSelect, { target: { value: "resolved" } });
    expect(onStatusChange).toHaveBeenCalledWith("resolved");
  });
});
