import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageDashboard } from "./UsageDashboard";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

describe("UsageDashboard", () => {
  const mockBillingState = {
    subscription: {
      status: "active",
      currentPeriodStart: "2026-04-01",
      currentPeriodEnd: "2026-05-01",
    },
    plan: {
      slug: "forge",
      displayName: "Forge",
      limits: {
        maxSessionsPerMonth: 100,
        maxPrograms: 10,
        maxSeats: 10,
      },
      overageRateUsd: 2.5,
    },
    usage: {
      sandboxSessionCount: 42,
      overageSessionCount: 2,
      totalAiCostUsd: 15.5,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing without subscription", () => {
    const state = { subscription: null, plan: null, usage: null };
    const { container } = render(<UsageDashboard billingState={state as any} orgId="org-1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Usage heading with valid billing state", () => {
    render(<UsageDashboard billingState={mockBillingState as any} orgId="org-1" />);
    expect(screen.getByText("Usage")).toBeInTheDocument();
  });

  it("renders sandbox sessions meter", () => {
    render(<UsageDashboard billingState={mockBillingState as any} orgId="org-1" />);
    expect(screen.getByText("Sandbox Sessions")).toBeInTheDocument();
  });

  it("renders programs meter", () => {
    render(<UsageDashboard billingState={mockBillingState as any} orgId="org-1" />);
    expect(screen.getByText("Programs")).toBeInTheDocument();
  });

  it("renders seats meter", () => {
    render(<UsageDashboard billingState={mockBillingState as any} orgId="org-1" />);
    expect(screen.getByText("Seats")).toBeInTheDocument();
  });

  it("renders AI cost summary", () => {
    render(<UsageDashboard billingState={mockBillingState as any} orgId="org-1" />);
    expect(screen.getByText("AI Cost This Period")).toBeInTheDocument();
  });
});
