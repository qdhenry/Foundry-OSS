"use client";

import { SERVICE_CONFIGS } from "../../resilience/constants";
import type { ServiceName } from "../../resilience/types";

interface ServiceErrorToastProps {
  service: ServiceName;
  message?: string;
  onRetry?: () => void;
}

export function ServiceErrorToast({ service, message, onRetry }: ServiceErrorToastProps) {
  const config = SERVICE_CONFIGS[service];
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-status-error-fg" />
        <span className="text-sm font-medium text-text-primary">
          {config?.displayName ?? service} unavailable
        </span>
      </div>
      {message && <p className="text-xs text-text-muted">{message.slice(0, 150)}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-start rounded-md bg-interactive-default px-3 py-1 text-xs font-medium text-white hover:bg-interactive-hover"
        >
          Retry now
        </button>
      )}
    </div>
  );
}
