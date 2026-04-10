import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingState } from "./SubscriptionCard";
import { SubscriptionCard } from "./SubscriptionCard";

const mocks = vi.hoisted(() => ({
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("convex/react", () => ({
  useAction: mocks.useAction,
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeActiveBillingState(): BillingState {
  return {
    subscription: {
      planSlug: "crucible",
      status: "active",
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
}

function makeTrialBillingState(): BillingState {
  return {
    subscription: null,
    trial: {
      sessionsUsed: 0,
      sessionsLimit: 10,
      programsUsed: 1,
      programsLimit: 1,
      startedAt: Date.now() - 86400000,
    },
    plan: null,
    usage: null,
  };
}

function makeDesignPartnerBillingState(): BillingState {
  return {
    subscription: null,
    trial: null,
    plan: null,
    usage: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SubscriptionCard", () => {
  beforeEach(() => {
    mocks.useAction.mockReset();
    mocks.useAction.mockReturnValue(vi.fn());
  });

  describe("Active subscription state", () => {
    it('renders plan name "Crucible" badge', () => {
      render(<SubscriptionCard billingState={makeActiveBillingState()} orgId="org_test" />);
      expect(screen.getByText("Crucible")).toBeInTheDocument();
    });

    it('renders "Active" status badge', () => {
      render(<SubscriptionCard billingState={makeActiveBillingState()} orgId="org_test" />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("shows current period dates", () => {
      render(<SubscriptionCard billingState={makeActiveBillingState()} orgId="org_test" />);
      expect(screen.getByText(/Mar 1, 2026/)).toBeInTheDocument();
      expect(screen.getByText(/Apr 1, 2026/)).toBeInTheDocument();
    });

    it('shows monthly price "$299"', () => {
      render(<SubscriptionCard billingState={makeActiveBillingState()} orgId="org_test" />);
      expect(screen.getByText("$299/mo")).toBeInTheDocument();
    });

    it('shows "Manage Subscription" button', () => {
      render(<SubscriptionCard billingState={makeActiveBillingState()} orgId="org_test" />);
      expect(screen.getByRole("button", { name: "Manage Subscription" })).toBeInTheDocument();
    });

    it("calls createPortalSession when Manage Subscription is clicked", async () => {
      const user = userEvent.setup();
      const mockPortalAction = vi
        .fn()
        .mockResolvedValue({ url: "https://billing.stripe.com/portal" });
      mocks.useAction.mockReturnValue(mockPortalAction);

      // Mock window.open
      const originalOpen = window.open;
      window.open = vi.fn();

      render(<SubscriptionCard billingState={makeActiveBillingState()} orgId="org_test" />);

      await user.click(screen.getByRole("button", { name: "Manage Subscription" }));

      expect(mockPortalAction).toHaveBeenCalledWith({
        orgId: "org_test",
        returnUrl: expect.any(String),
      });

      window.open = originalOpen;
    });
  });

  describe("Trial state", () => {
    it('renders "The Smelt Experience" heading', () => {
      render(<SubscriptionCard billingState={makeTrialBillingState()} orgId="org_test" />);
      expect(screen.getByText("The Smelt Experience")).toBeInTheDocument();
    });

    it('shows "Free Trial" badge', () => {
      render(<SubscriptionCard billingState={makeTrialBillingState()} orgId="org_test" />);
      expect(screen.getByText("Free Trial")).toBeInTheDocument();
    });

    it('shows "0 of 10" sessions', () => {
      render(<SubscriptionCard billingState={makeTrialBillingState()} orgId="org_test" />);
      expect(screen.getByText("0 of 10")).toBeInTheDocument();
    });

    it("shows progress bar", () => {
      render(<SubscriptionCard billingState={makeTrialBillingState()} orgId="org_test" />);
      // The progress bar container has the w-full class
      const bars = document.querySelectorAll(".h-2.w-full");
      expect(bars.length).toBeGreaterThan(0);
    });

    it('calls onUpgrade when "Upgrade" button is clicked', async () => {
      const user = userEvent.setup();
      const onUpgrade = vi.fn();

      render(
        <SubscriptionCard
          billingState={makeTrialBillingState()}
          orgId="org_test"
          onUpgrade={onUpgrade}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Upgrade" }));
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  describe("Design partner state", () => {
    it('renders "Design Partner" badge', () => {
      render(<SubscriptionCard billingState={makeDesignPartnerBillingState()} orgId="org_test" />);
      expect(screen.getByText("Design Partner")).toBeInTheDocument();
    });

    it('shows "No billing configured" message', () => {
      render(<SubscriptionCard billingState={makeDesignPartnerBillingState()} orgId="org_test" />);
      expect(screen.getByText(/No billing configured/)).toBeInTheDocument();
    });
  });
});
