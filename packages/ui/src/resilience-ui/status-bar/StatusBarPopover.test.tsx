import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusBarPopover } from "./StatusBarPopover";

vi.mock("../../resilience/ResilienceProvider", () => ({
  useResilienceState: () => ({
    services: {
      convex: { status: "healthy" },
      clerk: { status: "degraded" },
      anthropic: { status: "outage" },
    },
    networkOnline: true,
  }),
}));

vi.mock("./StatusDot", () => ({
  StatusDot: ({ status }: { status: string }) => <span data-testid={`dot-${status}`} />,
}));

describe("StatusBarPopover", () => {
  it("renders Service Health heading", () => {
    render(<StatusBarPopover onClose={vi.fn()} />);
    expect(screen.getByText("Service Health")).toBeInTheDocument();
  });

  it("renders service list with display names", () => {
    render(<StatusBarPopover onClose={vi.fn()} />);
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<StatusBarPopover onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders link to status page", () => {
    render(<StatusBarPopover onClose={vi.fn()} />);
    expect(screen.getByText("View status page")).toBeInTheDocument();
  });
});
