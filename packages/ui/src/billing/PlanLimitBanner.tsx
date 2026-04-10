"use client";

interface PlanLimitBannerProps {
  resource: "program" | "seat";
  currentCount: number;
  limit: number;
  currentPlanName: string;
  suggestedPlanName: string;
  onUpgrade: () => void;
}

const VALUE_PROPS: Record<string, string> = {
  Forge: "Get up to 10 seats, unlimited programs, and 300 sessions per month.",
  Foundry: "Unlock unlimited seats, unlimited programs, custom SLA, and SSO.",
};

/**
 * Inline banner shown when a hard limit (programs or seats) is reached.
 * Displays the current count vs. limit and offers a direct upgrade path
 * to the suggested next tier.
 */
export function PlanLimitBanner({
  resource,
  currentCount,
  limit,
  currentPlanName,
  suggestedPlanName,
  onUpgrade,
}: PlanLimitBannerProps) {
  const resourceLabel = resource === "program" ? "programs" : "seats";
  const valueProp =
    VALUE_PROPS[suggestedPlanName] ??
    `Upgrade for higher ${resourceLabel} limits and more features.`;

  return (
    <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-warning-fg/10">
            <svg
              className="h-5 w-5 text-status-warning-fg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              You&apos;ve reached the maximum of {limit} {resourceLabel} on your {currentPlanName}{" "}
              plan.
            </p>
            <p className="mt-1 text-sm text-text-secondary">{valueProp}</p>
          </div>
        </div>
        <button
          onClick={onUpgrade}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand shadow-sm transition-all hover:bg-accent-strong hover:shadow-md"
        >
          Upgrade to {suggestedPlanName}
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
