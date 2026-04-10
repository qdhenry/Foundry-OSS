import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaleDataBanner } from "./StaleDataBanner";

const mockConnectionMonitor = {
  getState: vi.fn().mockReturnValue({ state: "connected", staleMs: 0 }),
  subscribe: vi.fn().mockReturnValue(() => {}),
};

vi.mock("../../resilience/ResilienceProvider", () => ({
  useResilience: () => ({ connectionMonitor: mockConnectionMonitor }),
}));

describe("StaleDataBanner", () => {
  it("renders nothing when connected", () => {
    mockConnectionMonitor.getState.mockReturnValue({ state: "connected", staleMs: 0 });
    const { container } = render(<StaleDataBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows reconnecting message", () => {
    mockConnectionMonitor.getState.mockReturnValue({ state: "reconnecting", staleMs: 5000 });
    render(<StaleDataBanner />);
    expect(screen.getByText(/Reconnecting to server/)).toBeInTheDocument();
  });

  it("shows connection lost message for disconnected", () => {
    mockConnectionMonitor.getState.mockReturnValue({ state: "disconnected", staleMs: 15000 });
    render(<StaleDataBanner />);
    expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
  });
});
