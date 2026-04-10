import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanLimitBanner } from "./PlanLimitBanner";

describe("PlanLimitBanner", () => {
  const defaultProps = {
    resource: "program" as const,
    currentCount: 3,
    limit: 3,
    currentPlanName: "Crucible",
    suggestedPlanName: "Forge",
    onUpgrade: vi.fn(),
  };

  it("renders limit reached message with program resource", () => {
    render(<PlanLimitBanner {...defaultProps} />);
    expect(screen.getByText(/reached the maximum of 3 programs/)).toBeInTheDocument();
  });

  it("renders limit reached message with seat resource", () => {
    render(<PlanLimitBanner {...defaultProps} resource="seat" />);
    expect(screen.getByText(/3 seats/)).toBeInTheDocument();
  });

  it("renders suggested plan value prop for Forge", () => {
    render(<PlanLimitBanner {...defaultProps} />);
    expect(screen.getByText(/Get up to 10 seats/)).toBeInTheDocument();
  });

  it("renders upgrade button with suggested plan name", () => {
    render(<PlanLimitBanner {...defaultProps} />);
    expect(screen.getByText("Upgrade to Forge")).toBeInTheDocument();
  });

  it("calls onUpgrade when button is clicked", () => {
    const onUpgrade = vi.fn();
    render(<PlanLimitBanner {...defaultProps} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByText("Upgrade to Forge"));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it("renders fallback value prop for unknown plan", () => {
    render(<PlanLimitBanner {...defaultProps} suggestedPlanName="Custom" />);
    expect(screen.getByText(/Upgrade for higher programs limits/)).toBeInTheDocument();
  });
});
