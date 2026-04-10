"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import type { BillingState } from "./SubscriptionCard";
import { SubscriptionCard } from "./SubscriptionCard";
import { UpgradeFlow } from "./UpgradeFlow";
import { UsageDashboard } from "./UsageDashboard";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Subscription card skeleton */}
      <div className="card rounded-xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-5 w-28 animate-pulse rounded bg-surface-raised" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-surface-raised" />
        </div>
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-surface-raised" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-16 animate-pulse rounded-lg bg-surface-raised" />
          <div className="h-16 animate-pulse rounded-lg bg-surface-raised" />
        </div>
      </div>

      {/* Usage dashboard skeleton */}
      <div className="card rounded-xl p-6">
        <div className="mb-4 h-5 w-16 animate-pulse rounded bg-surface-raised" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-20 animate-pulse rounded-lg bg-surface-raised" />
          <div className="h-20 animate-pulse rounded-lg bg-surface-raised" />
          <div className="h-20 animate-pulse rounded-lg bg-surface-raised" />
          <div className="h-20 animate-pulse rounded-lg bg-surface-raised" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Billing settings tab
// ---------------------------------------------------------------------------

interface BillingSettingsTabProps {
  orgId: string;
}

export function BillingSettingsTab({ orgId }: BillingSettingsTabProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const billingState = useQuery(
    "billing/subscriptions:getOrgBillingState" as any,
    orgId ? { orgId } : "skip",
  ) as BillingState | undefined;

  if (billingState === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <SubscriptionCard
        billingState={billingState}
        orgId={orgId}
        onUpgrade={() => setShowUpgrade(true)}
      />
      {showUpgrade && !billingState.subscription && <UpgradeFlow orgId={orgId} />}
      {billingState.subscription && <UsageDashboard billingState={billingState} orgId={orgId} />}
    </div>
  );
}
