"use client";

import Link from "next/link";

export interface NextStep {
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
}

interface StageNextStepsProps {
  steps: NextStep[];
}

export function StageNextSteps({ steps }: StageNextStepsProps) {
  if (steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-status-info-border bg-status-info-bg p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-4 w-4 text-accent-default"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <h4 className="text-xs font-semibold text-accent-default">Next Steps</h4>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-info-bg text-[10px] font-bold text-accent-default">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              {step.href ? (
                <Link
                  href={step.href}
                  className="text-sm font-medium text-accent-default hover:underline"
                >
                  {step.label}
                </Link>
              ) : step.onClick ? (
                <button
                  type="button"
                  onClick={step.onClick}
                  className="text-sm font-medium text-accent-default hover:underline"
                >
                  {step.label}
                </button>
              ) : (
                <span className="text-sm font-medium text-accent-default">{step.label}</span>
              )}
              <p className="text-xs text-accent-default/80">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
