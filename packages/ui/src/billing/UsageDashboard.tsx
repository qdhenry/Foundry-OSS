"use client";

import { useQuery } from "convex/react";
import type { BillingState } from "./SubscriptionCard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function progressBarColor(current: number, limit: number): string {
  if (limit <= 0) return "bg-accent-default";
  const ratio = current / limit;
  if (ratio > 1) return "bg-status-error-fg";
  if (ratio >= 0.8) return "bg-status-warning-fg";
  return "bg-accent-default";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MeterProps {
  label: string;
  current: number;
  limit: number; // -1 means unlimited
  unit?: string;
  overageCount?: number;
  overageRate?: number;
}

function UsageMeter({ label, current, limit, unit, overageCount, overageRate }: MeterProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited
    ? 0
    : limit > 0
      ? Math.min(100, Math.round((current / limit) * 100))
      : 0;
  const barColor = isUnlimited ? "bg-accent-default" : progressBarColor(current, limit);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        <span className="text-sm font-medium text-text-primary">
          {isUnlimited ? (
            <span className="flex items-center gap-1">
              {current} {unit ?? ""}
              <svg
                className="h-4 w-4 text-status-success-fg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-text-tertiary">unlimited</span>
            </span>
          ) : (
            <>
              {current} of {limit} {unit ?? ""}
            </>
          )}
        </span>
      </div>

      {!isUnlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-default">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {overageCount !== undefined && overageCount > 0 && overageRate !== undefined && (
        <div className="mt-2 rounded border border-status-warning-border bg-status-warning-bg px-2 py-1">
          <p className="text-xs font-medium text-status-warning-fg">
            {overageCount} overage session{overageCount !== 1 ? "s" : ""} at{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 0,
            }).format(overageRate)}
            /session
          </p>
        </div>
      )}
    </div>
  );
}

interface CostSummaryProps {
  totalCostUsd: number;
  cacheHitRate: number;
}

function AiCostSummary({ totalCostUsd, cacheHitRate }: CostSummaryProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
        AI Cost This Period
      </span>

      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-xl font-semibold text-text-primary">
          {formatCurrency(totalCostUsd)}
        </span>
        <span className="text-xs text-text-tertiary">
          Cache hit rate: {formatPercentage(cacheHitRate)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface UsageDashboardProps {
  billingState: BillingState;
  orgId: string;
}

export function UsageDashboard({ billingState, orgId }: UsageDashboardProps) {
  const { subscription, plan, usage } = billingState;

  // Fetch cost summary for the current period
  const costSummary = useQuery(
    "billing/analytics:getOrgCostSummary" as any,
    subscription && orgId
      ? {
          orgId,
          startDate: subscription.currentPeriodStart,
          endDate: subscription.currentPeriodEnd,
        }
      : "skip",
  );

  if (!subscription || !plan) {
    return null;
  }

  // Extract usage numbers
  const sessionCount = usage?.sandboxSessionCount ?? 0;
  const sessionLimit = plan.limits.maxSessionsPerMonth;
  const overageCount = usage?.overageSessionCount ?? 0;
  const overageRate = plan.overageRateUsd;

  const programCount = 0; // Programs are counted at org level — the billing query doesn't track this directly
  const programLimit = plan.limits.maxPrograms;

  const seatCount = 1; // Seat count comes from Clerk org members — not tracked in billing state
  const seatLimit = plan.limits.maxSeats;

  const totalCostUsd = usage?.totalAiCostUsd ?? costSummary?.totalCostUsd ?? 0;
  const cacheHitRate = costSummary?.cacheHitRate ?? 0;

  return (
    <div className="card rounded-xl p-6">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">Usage</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UsageMeter
          label="Sandbox Sessions"
          current={sessionCount}
          limit={sessionLimit}
          unit="sessions"
          overageCount={overageCount}
          overageRate={overageRate}
        />

        <UsageMeter label="Programs" current={programCount} limit={programLimit} unit="programs" />

        <UsageMeter label="Seats" current={seatCount} limit={seatLimit} unit="seats" />

        <AiCostSummary totalCostUsd={totalCostUsd} cacheHitRate={cacheHitRate} />
      </div>
    </div>
  );
}
