import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalStatusBar } from "./GlobalStatusBar";

const mockServices: Record<string, { status: string }> = {};

vi.mock("../../resilience/ResilienceProvider", () => ({
  useResilienceState: () => ({ services: mockServices, networkOnline: true }),
}));

vi.mock("./StatusBarPopover", () => ({
  StatusBarPopover: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="popover">
      <button onClick={onClose} type="button">
        Close
      </button>
    </div>
  ),
}));

vi.mock("./StatusDot", () => ({
  StatusDot: ({ status }: { status: string }) => <span data-testid={`dot-${status}`} />,
}));

describe("GlobalStatusBar", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockServices)) delete mockServices[key];
  });

  it("renders healthy dot when all services healthy", () => {
    mockServices.convex = { status: "healthy" };
    render(<GlobalStatusBar />);
    expect(screen.getByTestId("dot-healthy")).toBeInTheDocument();
  });

  it("shows summary text when services have outage", () => {
    mockServices.convex = { status: "outage" };
    render(<GlobalStatusBar />);
    expect(screen.getByText(/1 service down/)).toBeInTheDocument();
  });

  it("opens popover on click", () => {
    mockServices.convex = { status: "outage" };
    render(<GlobalStatusBar />);
    fireEvent.click(screen.getByLabelText("Service health status"));
    expect(screen.getByTestId("popover")).toBeInTheDocument();
  });
});
