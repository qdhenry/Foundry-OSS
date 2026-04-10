"use client";

import { useAction } from "convex/react";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types matching the billingState shape from getOrgBillingState
// ---------------------------------------------------------------------------

interface Subscription {
  planSlug: "crucible" | "forge" | "foundry";
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "paused";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  trialEnd?: number;
  metadata?: unknown;
}

interface Trial {
  sessionsUsed: number;
  sessionsLimit: number;
  programsUsed: number;
  programsLimit: number;
  startedAt: number;
  convertedAt?: number;
  convertedToPlan?: string;
}

interface Plan {
  slug: string;
  displayName: string;
  tagline: string;
  monthlyPriceUsd: number;
  overageRateUsd: number;
  limits: {
    maxSeats: number;
    maxPrograms: number;
    maxSessionsPerMonth: number;
  };
  features: string[];
}

interface UsagePeriod {
  sandboxSessionCount: number;
  overageSessionCount: number;
  totalAiCostUsd: number;
}

export interface BillingState {
  subscription: Subscription | null;
  trial: Trial | null;
  plan: Plan | null;
  usage: UsagePeriod | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  active: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  trialing: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  past_due: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  canceled: "bg-status-error-bg text-status-error-fg border border-status-error-border",
  unpaid: "bg-status-error-bg text-status-error-fg border border-status-error-border",
  incomplete: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  paused: "bg-surface-raised text-text-secondary",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past Due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  paused: "Paused",
};

const TIER_STYLES: Record<string, string> = {
  crucible: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  forge: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  foundry: "bg-status-success-bg text-status-success-fg border border-status-success-border",
};

function formatPeriodDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SubscriptionCardProps {
  billingState: BillingState;
  orgId: string;
  onUpgrade?: () => void;
}

export function SubscriptionCard({ billingState, orgId, onUpgrade }: SubscriptionCardProps) {
  const { subscription, trial, plan } = billingState;
  const [managingPortal, setManagingPortal] = useState(false);
  const [portalError, setPortalError] = useState("");

  const createPortalSession = useAction("billing/checkout:createCustomerPortalSession" as any);

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    setPortalError("");
    try {
      const result = await createPortalSession({
        orgId,
        returnUrl: window.location.href,
      });
      if (result && typeof result === "object" && "url" in result) {
        window.open((result as { url: string }).url, "_blank");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to open billing portal";
      setPortalError(message);
    } finally {
      setManagingPortal(false);
    }
  };

  // -------------------------------------------------------------------------
  // State 1: Active subscription
  // -------------------------------------------------------------------------
  if (subscription && plan) {
    return (
      <div className="card rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Subscription</h2>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TIER_STYLES[subscription.planSlug] ?? "bg-surface-raised text-text-secondary"}`}
            >
              {plan.displayName}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[subscription.status] ?? "bg-surface-raised text-text-secondary"}`}
            >
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          </div>
        </div>

        <p className="mb-4 text-sm text-text-secondary">{plan.tagline}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border-default bg-surface-raised p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Current Period
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {formatPeriodDate(subscription.currentPeriodStart)} &mdash;{" "}
              {formatPeriodDate(subscription.currentPeriodEnd)}
            </p>
          </div>

          <div className="rounded-lg border border-border-default bg-surface-raised p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Monthly Price
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {formatCurrency(plan.monthlyPriceUsd)}/mo
            </p>
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="mt-4 rounded-lg border border-status-warning-border bg-status-warning-bg p-3">
            <p className="text-sm font-medium text-status-warning-fg">
              Subscription cancels on {formatPeriodDate(subscription.currentPeriodEnd)}
            </p>
            <p className="mt-1 text-xs text-status-warning-fg/80">
              You will retain access until the end of the current billing period.
            </p>
          </div>
        )}

        {portalError && (
          <div className="mt-4 rounded-lg border border-status-error-border bg-status-error-bg p-3">
            <p className="text-sm text-status-error-fg">{portalError}</p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleManageSubscription}
            disabled={managingPortal}
            className="btn-secondary btn-sm"
          >
            {managingPortal ? "Opening..." : "Manage Subscription"}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // State 2: Trial (no subscription)
  // -------------------------------------------------------------------------
  if (trial && !trial.convertedAt) {
    const sessionsUsed = trial.sessionsUsed;
    const sessionsLimit = trial.sessionsLimit;
    const percentage =
      sessionsLimit > 0 ? Math.min(100, Math.round((sessionsUsed / sessionsLimit) * 100)) : 0;
    const barColor =
      percentage >= 100
        ? "bg-status-error-fg"
        : percentage >= 80
          ? "bg-status-warning-fg"
          : "bg-accent-default";

    return (
      <div className="card rounded-xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">The Smelt Experience</h2>
          <span className="inline-flex rounded-full border border-status-info-border bg-status-info-bg px-2.5 py-1 text-xs font-medium text-status-info-fg">
            Free Trial
          </span>
        </div>

        <p className="mb-4 text-sm text-text-secondary">
          Explore Foundry with limited sandbox sessions before choosing a plan.
        </p>

        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-text-secondary">Sessions Used</span>
          <span className="font-medium text-text-primary">
            {sessionsUsed} of {sessionsLimit}
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {percentage >= 100 && (
          <p className="mt-2 text-xs text-status-error-fg">
            Trial sessions exhausted. Upgrade to continue using sandbox.
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onUpgrade} className="btn-primary btn-sm">
            Upgrade
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // State 3: No billing (design partner / not configured)
  // -------------------------------------------------------------------------
  return (
    <div className="card rounded-xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Billing</h2>
        <span className="inline-flex rounded-full bg-surface-raised px-2.5 py-1 text-xs font-medium text-text-secondary">
          Design Partner
        </span>
      </div>

      <p className="text-sm text-text-secondary">
        No billing configured for this organization. If you believe this is an error, contact
        support.
      </p>
    </div>
  );
}
