"use client";

import { SERVICE_CONFIGS } from "../../resilience/constants";
import type { ServiceName } from "../../resilience/types";

interface RecoveryToastProps {
  service: ServiceName;
}

export function RecoveryToast({ service }: RecoveryToastProps) {
  const config = SERVICE_CONFIGS[service];
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-status-success-fg" />
      <span className="text-sm text-text-primary">{config?.displayName ?? service} restored</span>
    </div>
  );
}
