"use client";

import { AlertTriangle, Camera, CheckCircle, Clock, XCircle } from "lucide-react";

interface VerificationSummaryProps {
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  screenshotCount: number;
  durationMs?: number;
  aiSummary?: string;
}

export function VerificationSummary({
  checksTotal,
  checksPassed,
  checksFailed,
  screenshotCount,
  durationMs,
  aiSummary,
}: VerificationSummaryProps) {
  const checksWarning = checksTotal - checksPassed - checksFailed;
  const durationLabel = durationMs
    ? durationMs > 60000
      ? `${Math.floor(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
      : `${Math.round(durationMs / 1000)}s`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-status-success-fg" />
          <span className="text-text-secondary">{checksPassed} passed</span>
        </div>
        {checksFailed > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-status-error-fg" />
            <span className="text-text-secondary">{checksFailed} failed</span>
          </div>
        )}
        {checksWarning > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-status-warning-fg" />
            <span className="text-text-secondary">{checksWarning} warnings</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-text-secondary">{screenshotCount} screenshots</span>
        </div>
        {durationLabel && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-text-secondary">{durationLabel}</span>
          </div>
        )}
      </div>

      {aiSummary && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-xs font-medium text-text-muted mb-1">AI Analysis</p>
          <p className="text-sm text-text-secondary">{aiSummary}</p>
        </div>
      )}
    </div>
  );
}
