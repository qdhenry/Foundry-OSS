"use client";

import { useEffect, useState } from "react";

interface TerminalReconnectOverlayProps {
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number;
  onCancel: () => void;
  onManualConnect: () => void;
}

export function TerminalReconnectOverlay({
  attempt,
  maxAttempts,
  nextRetryAt,
  onCancel,
  onManualConnect,
}: TerminalReconnectOverlayProps) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, nextRetryAt - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-component-terminal-bg/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border-default bg-surface-raised p-6 shadow-lg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-interactive-default" />
        <p className="text-sm font-medium text-text-primary">Connection lost</p>
        <p className="text-xs text-text-secondary">
          Reconnecting... attempt {attempt}/{maxAttempts}
          {countdown > 0 ? ` (${countdown}s)` : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-default px-3 py-1 text-xs text-text-secondary hover:bg-interactive-subtle"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onManualConnect}
            className="rounded-md bg-interactive-default px-3 py-1 text-xs text-white hover:bg-interactive-hover"
          >
            Connect manually
          </button>
        </div>
      </div>
    </div>
  );
}
