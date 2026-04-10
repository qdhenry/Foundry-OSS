import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceDegradedBanner } from "./ServiceDegradedBanner";

const mockServices: Record<string, { status: string }> = {};

vi.mock("../../resilience/ResilienceProvider", () => ({
  useResilienceState: () => ({ services: mockServices }),
}));

describe("ServiceDegradedBanner", () => {
  beforeEach(() => {
    // Reset all to healthy
    for (const key of Object.keys(mockServices)) delete mockServices[key];
  });

  it("renders nothing when all services are healthy", () => {
    mockServices.anthropic = { status: "healthy" };
    const { container } = render(<ServiceDegradedBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("shows banner for non-critical service outage", () => {
    mockServices.github = { status: "outage" };
    render(<ServiceDegradedBanner />);
    expect(screen.getByText("GitHub is currently unavailable")).toBeInTheDocument();
  });

  it("hides banner after dismiss", () => {
    mockServices.github = { status: "outage" };
    render(<ServiceDegradedBanner />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.queryByText("GitHub is currently unavailable")).not.toBeInTheDocument();
  });
});
