"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { useBillingSettingsUrl } from "./useProgramSlug";

interface TrialBannerProps {
  orgId: string;
}

/**
 * Persistent banner shown during trial. Renders above main content in the
 * dashboard shell. Automatically hides when the org has converted to a
 * paid subscription.
 *
 * States:
 * 1. Active trial, sessions remaining  -- subtle blue
 * 2. Nearly exhausted (<=2 remaining)   -- amber
 * 3. Exhausted (0 remaining)            -- prominent, dismissible
 * 4. Converted (has subscription)       -- render null
 */
export function TrialBanner({ orgId }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const settingsUrl = useBillingSettingsUrl();

  const trialStatus = useQuery("billing/trial:getTrialStatus" as any, orgId ? { orgId } : "skip") as
    | {
        isOnTrial: boolean;
        sessionsRemaining: number;
        programsRemaining: number;
        isExhausted: boolean;
        isConverted: boolean;
        sessionsUsed: number;
        sessionsLimit: number;
      }
    | undefined;

  // Loading or no data yet
  if (!trialStatus) return null;

  // Converted users see nothing
  if (trialStatus.isConverted) return null;

  // Not on trial (no trial initialized)
  if (!trialStatus.isOnTrial) return null;

  // Exhausted and dismissed for this session
  if (trialStatus.isExhausted && dismissed) return null;

  const { sessionsRemaining, sessionsLimit } = trialStatus;

  // State 3: Exhausted
  if (trialStatus.isExhausted) {
    return (
      <div className="relative flex items-center justify-between gap-4 border-b border-status-warning-border bg-status-warning-bg px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-warning-fg/10">
            <svg
              className="h-4 w-4 text-status-warning-fg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </span>
          <p className="text-sm font-medium text-status-warning-fg">
            Your free trial is complete. Upgrade to keep building.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={settingsUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-default px-4 py-1.5 text-sm font-medium text-text-on-brand shadow-sm transition-all hover:bg-accent-strong hover:shadow-md"
          >
            Choose a plan
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1 text-status-warning-fg/60 transition-colors hover:bg-status-warning-fg/10 hover:text-status-warning-fg"
            aria-label="Dismiss banner"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // State 2: Nearly exhausted (<=2 remaining)
  if (sessionsRemaining <= 2) {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-status-warning-border bg-status-warning-bg px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-warning-fg/10">
            <svg
              className="h-4 w-4 text-status-warning-fg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
            </svg>
          </span>
          <p className="text-sm font-medium text-status-warning-fg">
            Only {sessionsRemaining} {sessionsRemaining === 1 ? "session" : "sessions"} left in your
            free trial.
          </p>
        </div>
        <a
          href={settingsUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-default px-4 py-1.5 text-sm font-medium text-text-on-brand shadow-sm transition-all hover:bg-accent-strong hover:shadow-md"
        >
          Upgrade now
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
    );
  }

  // State 1: Active trial with sessions remaining
  return (
    <div className="flex items-center justify-between gap-4 border-b border-status-info-border bg-status-info-bg px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-info-fg/10">
          <svg
            className="h-4 w-4 text-status-info-fg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
        <p className="text-sm text-status-info-fg">
          You have{" "}
          <span className="font-semibold">
            {sessionsRemaining} of {sessionsLimit}
          </span>{" "}
          Smelt sessions remaining.
        </p>
      </div>
      <a
        href={settingsUrl}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-default transition-colors hover:text-accent-strong"
      >
        Upgrade
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    </div>
  );
}
