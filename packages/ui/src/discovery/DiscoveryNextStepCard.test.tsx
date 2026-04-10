import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock convex/react
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { DiscoveryNextStepCard } from "./DiscoveryNextStepCard";

const defaultProps = {
  unassignedCount: 15,
  totalCount: 50,
  workstreams: [
    { _id: "ws-1", name: "Product Data", shortCode: "PDM" },
    { _id: "ws-2", name: "User Auth", shortCode: "AUTH" },
  ],
  programId: "prog-1",
  slug: "test-program",
};

describe("DiscoveryNextStepCard", () => {
  it("renders unassigned count", () => {
    render(<DiscoveryNextStepCard {...defaultProps} />);
    expect(screen.getByText("15 unassigned requirements")).toBeInTheDocument();
  });

  it("renders assigned/total summary", () => {
    render(<DiscoveryNextStepCard {...defaultProps} />);
    expect(
      screen.getByText(
        "35 of 50 requirements are assigned to workstreams. Organize the remaining to track progress effectively.",
      ),
    ).toBeInTheDocument();
  });

  it("shows 'AI Suggest Groupings' button", () => {
    render(<DiscoveryNextStepCard {...defaultProps} />);
    expect(screen.getByText("AI Suggest Groupings")).toBeInTheDocument();
  });

  it("shows 'Assign Manually' button", () => {
    render(<DiscoveryNextStepCard {...defaultProps} />);
    expect(screen.getByText("Assign Manually")).toBeInTheDocument();
  });

  it("renders existing workstream badges", () => {
    render(<DiscoveryNextStepCard {...defaultProps} />);
    expect(screen.getByText("PDM")).toBeInTheDocument();
    expect(screen.getByText("AUTH")).toBeInTheDocument();
  });

  it("renders singular when unassignedCount is 1", () => {
    render(<DiscoveryNextStepCard {...defaultProps} unassignedCount={1} />);
    expect(screen.getByText("1 unassigned requirement")).toBeInTheDocument();
  });
});
