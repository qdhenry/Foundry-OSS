"use client";

import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { useProgramSettingsPath } from "./useProgramSlug";

interface UpgradeFlowProps {
  orgId: string;
  currentPlanSlug?: string;
}

interface PricingPlan {
  _id: string;
  slug: string;
  displayName: string;
  tagline: string;
  monthlyPriceUsd: number;
  annualPriceUsd?: number;
  overageRateUsd: number;
  limits: {
    maxSeats: number;
    maxPrograms: number;
    maxSessionsPerMonth: number;
  };
  features: string[];
  buyingMotion: string;
  sortOrder: number;
}

const CONTACT_SALES_URL = "#";

function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toLocaleString();
}

function formatPrice(plan: PricingPlan): string {
  if (plan.buyingMotion === "annual_contract") return "Custom";
  return `$${plan.monthlyPriceUsd.toLocaleString()}`;
}

function formatPriceSuffix(plan: PricingPlan): string {
  if (plan.buyingMotion === "annual_contract") return "pricing";
  return "/mo";
}

/**
 * Full-page tier comparison for upgrading. Shows three plan cards in a
 * responsive grid. Self-serve plans launch Stripe Checkout; the enterprise
 * tier links to a contact sales page.
 */
export function UpgradeFlow({ orgId, currentPlanSlug }: UpgradeFlowProps) {
  const settingsPath = useProgramSettingsPath();

  const plans = useQuery("billing/plans:getPricingPlans" as any) as PricingPlan[] | undefined;

  const createCheckout = useAction("billing/checkout:createCheckoutSession" as any);

  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: PricingPlan) {
    if (!orgId) return;

    // Enterprise / annual contract plans go to sales
    if (plan.buyingMotion === "annual_contract") {
      window.open(CONTACT_SALES_URL, "_blank");
      return;
    }

    setLoadingSlug(plan.slug);
    setError(null);

    try {
      const result = await createCheckout({
        orgId,
        planSlug: plan.slug,
        successUrl: `${window.location.origin}${settingsPath}?tab=billing&checkout=success`,
        cancelUrl: `${window.location.origin}${settingsPath}?tab=billing&checkout=cancelled`,
      });

      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to start checkout. Please try again.");
      setLoadingSlug(null);
    }
  }

  // Loading state
  if (!plans) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold text-text-heading">
            Choose your plan
          </h2>
          <p className="mt-2 text-text-secondary">Loading pricing plans...</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[480px] animate-pulse rounded-xl border border-border-default bg-surface-default"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-text-heading">Choose your plan</h2>
        <p className="mt-2 text-lg text-text-secondary">
          Start small, scale when you need to. Every plan includes the full Foundry platform.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlanSlug === plan.slug;
          const isPopular = plan.slug === "forge";
          const _isSelfServe =
            plan.buyingMotion === "self_serve" || plan.buyingMotion === "sales_assisted";
          const isLoading = loadingSlug === plan.slug;

          // Determine CTA label
          let ctaLabel = "Subscribe";
          if (isCurrent) {
            ctaLabel = "Current Plan";
          } else if (plan.buyingMotion === "annual_contract") {
            ctaLabel = "Contact Sales";
          } else if (
            currentPlanSlug &&
            plan.sortOrder < (plans.find((p) => p.slug === currentPlanSlug)?.sortOrder ?? 0)
          ) {
            ctaLabel = "Downgrade";
          } else if (currentPlanSlug) {
            ctaLabel = "Upgrade";
          }

          return (
            <div
              key={plan._id}
              className={`relative flex flex-col rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md ${
                isPopular
                  ? "border-accent-default ring-1 ring-accent-default/20"
                  : "border-border-default"
              } ${isCurrent ? "bg-status-info-bg" : "bg-[var(--component-card-bg)]"}`}
            >
              {/* Popular badge */}
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-accent-default px-3 py-1 text-xs font-semibold text-text-on-brand shadow-sm">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg border border-status-success-border px-3 py-1 text-xs font-semibold text-status-success-fg shadow-sm">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Current Plan
                  </span>
                </div>
              )}

              {/* Plan name + tagline */}
              <div className="mt-2">
                <h3 className="font-display text-xl font-semibold text-text-heading">
                  {plan.displayName}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{plan.tagline}</p>
              </div>

              {/* Price */}
              <div className="mt-5">
                <span className="text-3xl font-bold text-text-primary">{formatPrice(plan)}</span>
                <span className="ml-1 text-sm text-text-muted">{formatPriceSuffix(plan)}</span>
              </div>

              {/* Limits */}
              <div className="mt-5 space-y-2.5 rounded-lg border border-border-default bg-surface-raised p-4">
                <LimitRow label="Seats" value={formatLimit(plan.limits.maxSeats)} />
                <LimitRow label="Programs" value={formatLimit(plan.limits.maxPrograms)} />
                <LimitRow
                  label="Sessions / mo"
                  value={formatLimit(plan.limits.maxSessionsPerMonth)}
                />
                <div className="border-t border-border-default pt-2">
                  <LimitRow label="Overage rate" value={`$${plan.overageRateUsd}/session`} />
                </div>
              </div>

              {/* Feature list */}
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-status-success-fg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-6">
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || isLoading}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    isCurrent
                      ? "cursor-default border border-status-success-border bg-status-success-bg text-status-success-fg"
                      : isPopular
                        ? "bg-accent-default text-text-on-brand shadow-sm hover:bg-accent-strong hover:shadow-md disabled:opacity-60"
                        : "border border-border-default bg-surface-default text-text-primary shadow-sm hover:bg-surface-raised hover:border-border-strong disabled:opacity-60"
                  }`}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Redirecting...
                    </span>
                  ) : (
                    ctaLabel
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-center text-sm text-text-muted">
        All plans include a 14-day money-back guarantee. Need help choosing?{" "}
        <a href={CONTACT_SALES_URL} className="text-accent-default hover:text-accent-strong">
          Talk to our team
        </a>
        .
      </p>
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
