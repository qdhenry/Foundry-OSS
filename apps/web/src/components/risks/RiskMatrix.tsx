"use client";

type Severity = "critical" | "high" | "medium" | "low";
type Probability = "very_likely" | "likely" | "possible" | "unlikely";

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const PROBABILITIES: Probability[] = ["unlikely", "possible", "likely", "very_likely"];

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PROBABILITY_LABEL: Record<Probability, string> = {
  very_likely: "Very Likely",
  likely: "Likely",
  possible: "Possible",
  unlikely: "Unlikely",
};

// Risk score = severity index * probability index (0-indexed)
// Color mapping based on combined risk score
function getCellColor(sev: Severity, prob: Probability, isActive: boolean): string {
  const sevIdx = SEVERITIES.indexOf(sev);
  const probIdx = PROBABILITIES.indexOf(prob);
  const score = sevIdx + probIdx;

  // Base colors by risk score
  let base: string;
  if (score <= 1) {
    // Low risk - green
    base = isActive
      ? "bg-status-success-fg text-white ring-2 ring-status-success-border"
      : "bg-status-success-bg text-status-success-fg";
  } else if (score <= 3) {
    // Medium risk - yellow
    base = isActive
      ? "bg-status-warning-fg text-white ring-2 ring-status-warning-border"
      : "bg-status-warning-bg text-status-warning-fg";
  } else if (score <= 5) {
    // High risk - orange
    base = isActive
      ? "bg-status-warning-fg text-white ring-2 ring-status-warning-border"
      : "bg-status-warning-bg text-status-warning-fg";
  } else {
    // Critical risk - red
    base = isActive
      ? "bg-status-error-fg text-white ring-2 ring-status-error-border"
      : "bg-status-error-bg text-status-error-fg";
  }

  return base;
}

interface RiskMatrixProps {
  severity: Severity;
  probability: Probability;
}

export function RiskMatrix({ severity, probability }: RiskMatrixProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-text-primary">Risk Matrix</h3>
      <div className="overflow-hidden rounded-lg border border-border-default">
        {/* Column headers */}
        <div className="grid grid-cols-[80px_repeat(4,1fr)]">
          <div className="bg-surface-raised p-2" />
          {SEVERITIES.map((sev) => (
            <div
              key={sev}
              className="bg-surface-raised p-2 text-center text-[10px] font-semibold uppercase tracking-wide text-text-secondary"
            >
              {SEVERITY_LABEL[sev]}
            </div>
          ))}
        </div>

        {/* Rows (probability from high to low) */}
        {[...PROBABILITIES].reverse().map((prob) => (
          <div key={prob} className="grid grid-cols-[80px_repeat(4,1fr)]">
            {/* Row label */}
            <div className="flex items-center bg-surface-raised p-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {PROBABILITY_LABEL[prob]}
            </div>

            {/* Cells */}
            {SEVERITIES.map((sev) => {
              const isActive = sev === severity && prob === probability;
              return (
                <div
                  key={`${sev}-${prob}`}
                  className={`flex items-center justify-center p-2 ${getCellColor(sev, prob, isActive)}`}
                >
                  {isActive && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Axis labels */}
      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span className="pl-[80px]">Severity ---&gt;</span>
      </div>
    </div>
  );
}
