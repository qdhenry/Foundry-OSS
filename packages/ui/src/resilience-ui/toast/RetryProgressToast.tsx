"use client";

import { useEffect, useState } from "react";
import { SERVICE_CONFIGS } from "../../resilience/constants";
import type { RetryAttempt } from "../../resilience/types";

interface RetryProgressToastProps {
  attempt: RetryAttempt;
  onCancel?: () => void;
}

export function RetryProgressToast({ attempt, onCancel }: RetryProgressToastProps) {
  const [countdown, setCountdown] = useState(0);
  const config = SERVICE_CONFIGS[attempt.service];

  useEffect(() => {
    if (attempt.status !== "retrying" || !attempt.nextRetryAt) return;

    const update = () => {
      const remaining = Math.max(0, attempt.nextRetryAt - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
    };

    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [attempt.nextRetryAt, attempt.status]);

  const progress = attempt.attempt / attempt.maxAttempts;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-status-warning-fg" />
          <span className="text-sm font-medium text-text-primary">
            {config?.displayName ?? attempt.service}
          </span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="text-xs text-text-secondary">
        Attempt {attempt.attempt}/{attempt.maxAttempts}
        {countdown > 0 ? ` — retrying in ${countdown}s` : " — retrying..."}
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-status-warning-fg transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
