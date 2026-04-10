import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadOnlyModeBanner } from "./ReadOnlyModeBanner";

const mockState = {
  readOnlyMode: false,
  services: {},
  convexConnected: true,
  networkOnline: true,
  activeRetries: [],
};

vi.mock("../../resilience/ResilienceProvider", () => ({
  useResilienceState: () => mockState,
}));

describe("ReadOnlyModeBanner", () => {
  it("renders nothing when readOnlyMode is false", () => {
    mockState.readOnlyMode = false;
    const { container } = render(<ReadOnlyModeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders warning when readOnlyMode is true", () => {
    mockState.readOnlyMode = true;
    render(<ReadOnlyModeBanner />);
    expect(screen.getByText(/Changes cannot be saved/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
