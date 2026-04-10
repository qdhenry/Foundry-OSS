import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  const defaultProps = {
    label: "Acceptance Rate",
    value: "95%",
    subtitle: "19 of 20 accepted",
    colorClass: "text-status-success-fg",
    onClick: vi.fn(),
  };

  it("renders label, value, and subtitle", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("Acceptance Rate")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("19 of 20 accepted")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<MetricCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies custom bgClass", () => {
    render(<MetricCard {...defaultProps} bgClass="bg-surface-elevated" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-surface-elevated");
  });

  it("uses default bgClass when not provided", () => {
    render(<MetricCard {...defaultProps} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-surface-raised");
  });
});
