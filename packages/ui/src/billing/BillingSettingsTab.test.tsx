import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingSettingsTab } from "./BillingSettingsTab";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useAction: vi.fn(() => vi.fn()),
  usePathname: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mocks.useQuery,
  useAction: mocks.useAction,
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

// Mock child components that compose BillingSettingsTab
vi.mock("./UpgradeFlow", () => ({
  UpgradeFlow: ({ orgId }: { orgId: string }) => (
    <div data-testid="upgrade-flow">UpgradeFlow for {orgId}</div>
  ),
}));

vi.mock("./UsageDashboard", () => ({
  UsageDashboard: () => <div data-testid="usage-dashboard">UsageDashboard</div>,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const activeBillingState = {
  subscription: {
    planSlug: "crucible" as const,
    status: "active" as const,
    currentPeriodStart: new Date("2026-03-01T12:00:00").getTime(),
    currentPeriodEnd: new Date("2026-04-01T12:00:00").getTime(),
    cancelAtPeriodEnd: false,
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
  },
  trial: null,
  plan: {
    slug: "crucible",
    displayName: "Crucible",
    tagline: "For small teams getting started",
    monthlyPriceUsd: 299,
    overageRateUsd: 5,
    limits: { maxSeats: 5, maxPrograms: 3, maxSessionsPerMonth: 50 },
    features: ["50 sandbox sessions", "3 programs"],
  },
  usage: {
    sandboxSessionCount: 12,
    overageSessionCount: 0,
    totalAiCostUsd: 42.5,
  },
};

const trialBillingState = {
  subscription: null,
  trial: {
    sessionsUsed: 3,
    sessionsLimit: 10,
    programsUsed: 1,
    programsLimit: 1,
    startedAt: Date.now() - 86400000,
  },
  plan: null,
  usage: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BillingSettingsTab", () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useAction.mockReset();
    mocks.useAction.mockReturnValue(vi.fn());
    mocks.usePathname.mockReturnValue("/boston-beer-merchtank/settings");
  });

  it("shows loading skeleton when useQuery returns undefined", () => {
    mocks.useQuery.mockReturnValue(undefined);

    const { container } = render(<BillingSettingsTab orgId="org_test" />);

    // LoadingSkeleton renders elements with animate-pulse
    const pulsingElements = container.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("renders SubscriptionCard when data loads (active subscription)", () => {
    mocks.useQuery.mockReturnValue(activeBillingState);

    render(<BillingSettingsTab orgId="org_test" />);

    // SubscriptionCard renders plan display name
    expect(screen.getByText("Crucible")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders UsageDashboard for subscription state (not UpgradeFlow)", () => {
    mocks.useQuery.mockReturnValue(activeBillingState);

    render(<BillingSettingsTab orgId="org_test" />);

    expect(screen.getByTestId("usage-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("upgrade-flow")).not.toBeInTheDocument();
  });

  it('shows UpgradeFlow after "Upgrade" button click in trial state', async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockReturnValue(trialBillingState);

    render(<BillingSettingsTab orgId="org_test" />);

    // UpgradeFlow should not be visible initially
    expect(screen.queryByTestId("upgrade-flow")).not.toBeInTheDocument();

    // Click the Upgrade button rendered by SubscriptionCard trial state
    await user.click(screen.getByRole("button", { name: "Upgrade" }));

    // UpgradeFlow should now be visible
    expect(screen.getByTestId("upgrade-flow")).toBeInTheDocument();
  });

  it("does NOT show UpgradeFlow for active subscription state even if Manage Subscription is clicked", async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockReturnValue(activeBillingState);

    render(<BillingSettingsTab orgId="org_test" />);

    await user.click(screen.getByRole("button", { name: "Manage Subscription" }));

    // UpgradeFlow should still not be present
    expect(screen.queryByTestId("upgrade-flow")).not.toBeInTheDocument();
    // UsageDashboard should still be present
    expect(screen.getByTestId("usage-dashboard")).toBeInTheDocument();
  });
});
