"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "foundry-overage-warning-dismissed";

interface OverageWarningModalProps {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
  overageRate: number;
  currentOverageCount: number;
}

/**
 * Modal shown when a subscriber launches a sandbox session that exceeds
 * their plan's included session count. Warns about per-session overage
 * billing and offers upgrade path.
 *
 * Includes a "Don't show again this session" checkbox backed by localStorage.
 */
export function OverageWarningModal({
  open,
  onClose,
  onContinue,
  onUpgrade,
  overageRate,
  currentOverageCount,
}: OverageWarningModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed === "true") {
        setDontShowAgain(true);
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // localStorage unavailable — ignore
      }
    }
    onContinue();
  }, [dontShowAgain, onContinue]);

  // If user previously checked "don't show", auto-continue
  useEffect(() => {
    if (open && dontShowAgain) {
      try {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed === "true") {
          onContinue();
        }
      } catch {
        // localStorage unavailable
      }
    }
  }, [open, dontShowAgain, onContinue]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl border border-border-default bg-[var(--component-modal-bg)] p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon + Header */}
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-warning-bg">
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-heading">Overage Session</h3>
              <p className="mt-1 text-sm text-text-secondary">
                You&apos;ve used all included sessions this month.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Details */}
          <div className="mt-5 space-y-3 rounded-lg border border-border-default bg-surface-raised p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">This session cost</span>
              <span className="font-semibold text-text-primary">${overageRate.toFixed(2)}</span>
            </div>
            <div className="border-t border-border-default" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Overage sessions this month</span>
              <span className="font-semibold text-text-primary">{currentOverageCount}</span>
            </div>
          </div>

          {/* Checkbox */}
          <label className="mt-4 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-accent-default focus:ring-accent-default"
            />
            <span className="text-sm text-text-secondary">Don&apos;t show again this session</span>
          </label>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onUpgrade}
              className="inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-default px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition-all hover:bg-surface-raised hover:border-border-strong"
            >
              Upgrade Plan
            </button>
            <button
              onClick={handleContinue}
              className="inline-flex items-center justify-center rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand shadow-sm transition-all hover:bg-accent-strong hover:shadow-md"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
