"use client";

interface WizardStepIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps: number[];
}

export function WizardStepIndicator({
  steps,
  currentStep,
  completedSteps,
}: WizardStepIndicatorProps) {
  return (
    <nav className="mb-8">
      <ol className="flex items-center">
        {steps.map((label, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={label} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    isCompleted
                      ? "bg-accent-default text-text-on-brand"
                      : isCurrent
                        ? "border-2 border-accent-default bg-status-info-bg text-accent-default"
                        : "border-2 border-border-default bg-surface-default text-text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 hidden text-xs font-medium sm:block ${
                    isCurrent
                      ? "text-accent-default"
                      : isCompleted
                        ? "text-text-primary"
                        : "text-text-muted"
                  }`}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-2 h-0.5 w-full min-w-[2rem] transition-colors ${
                    isCompleted ? "bg-accent-default" : "bg-surface-elevated"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
