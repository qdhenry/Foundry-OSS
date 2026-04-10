import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuditFilters } from "./AuditFilters";

describe("AuditFilters", () => {
  const defaultProps = {
    entityType: "",
    limit: 50,
    onEntityTypeChange: vi.fn(),
    onLimitChange: vi.fn(),
  };

  it("renders All Types as default entity type option", () => {
    render(<AuditFilters {...defaultProps} />);
    expect(screen.getByText("All Types")).toBeInTheDocument();
  });

  it("renders entity type options", () => {
    render(<AuditFilters {...defaultProps} />);
    expect(screen.getByText("Requirement")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("Risk")).toBeInTheDocument();
  });

  it("renders limit options", () => {
    render(<AuditFilters {...defaultProps} />);
    expect(screen.getByText("25 entries")).toBeInTheDocument();
    expect(screen.getByText("50 entries")).toBeInTheDocument();
    expect(screen.getByText("100 entries")).toBeInTheDocument();
    expect(screen.getByText("200 entries")).toBeInTheDocument();
  });

  it("hides Clear filters when at defaults", () => {
    render(<AuditFilters {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("shows Clear filters when filters are active", () => {
    render(<AuditFilters {...defaultProps} entityType="task" />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("calls callbacks when Clear filters clicked", () => {
    const onEntityTypeChange = vi.fn();
    const onLimitChange = vi.fn();
    render(
      <AuditFilters
        {...defaultProps}
        entityType="task"
        onEntityTypeChange={onEntityTypeChange}
        onLimitChange={onLimitChange}
      />,
    );
    fireEvent.click(screen.getByText("Clear filters"));
    expect(onEntityTypeChange).toHaveBeenCalledWith("");
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });
});
