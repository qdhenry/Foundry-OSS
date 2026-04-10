"use client";

const STAGES = [
  { key: "scanning", label: "Scan", description: "Scanning repository structure and files" },
  { key: "analyzing", label: "Analyze", description: "Analyzing code patterns and dependencies" },
  { key: "mapping", label: "Map", description: "Building knowledge graph relationships" },
  { key: "touring", label: "Tour", description: "Generating guided code tours" },
  { key: "reviewing", label: "Review", description: "Reviewing and finalizing analysis" },
] as const;

const STAGE_ORDER: Record<string, number> = {
  pending: -1,
  scanning: 0,
  analyzing: 1,
  mapping: 2,
  touring: 3,
  reviewing: 4,
  completed: 5,
  failed: -2,
};

export interface AnalysisProgressProps {
  status: string;
  currentStage?: string;
}

export function AnalysisProgress({ status, currentStage }: AnalysisProgressProps) {
  const activeStage = currentStage ?? status;
  const activeIndex = STAGE_ORDER[activeStage] ?? -1;
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  const currentDescription = STAGES.find((s) => s.key === activeStage)?.description;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {STAGES.map((stage, index) => {
          const isActive = stage.key === activeStage;
          const isDone = isCompleted || activeIndex > index;
          const _isFutureOrFailed = isFailed || activeIndex < index;

          return (
            <div key={stage.key} className="flex flex-1 items-center">
              {/* Dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                    isDone
                      ? "bg-status-success-bg text-status-success-fg"
                      : isActive
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse"
                        : isFailed && isActive
                          ? "bg-status-error-bg text-status-error-fg"
                          : "bg-surface-raised text-text-muted"
                  }`}
                >
                  {isDone ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium ${
                    isDone
                      ? "text-status-success-fg"
                      : isActive
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-text-muted"
                  }`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STAGES.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded-full transition-all duration-200 ${
                    isDone ? "bg-status-success-fg/30" : "bg-border-default"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {currentDescription && !isCompleted && (
        <p className="text-center text-xs text-text-secondary">{currentDescription}</p>
      )}

      {isCompleted && (
        <p className="text-center text-xs text-status-success-fg font-medium">Analysis complete</p>
      )}

      {isFailed && (
        <p className="text-center text-xs text-status-error-fg font-medium">Analysis failed</p>
      )}
    </div>
  );
}
