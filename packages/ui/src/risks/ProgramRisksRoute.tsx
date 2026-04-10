"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useProgramContext } from "../programs";
import { useStaggerEntrance } from "../theme/useAnimations";
import { RiskAssessmentPanel } from "./RiskAssessmentPanel";
import { RiskCard } from "./RiskCard";
import { RiskFilters } from "./RiskFilters";

type Severity = "critical" | "high" | "medium" | "low";
type Status = "open" | "mitigating" | "resolved" | "accepted";

type RiskRecord = {
  _id: string;
  title: string;
  description?: string;
  severity: Severity;
  probability: "very_likely" | "likely" | "possible" | "unlikely";
  status: Status;
  ownerName?: string;
  resolvedWorkstreams?: { _id: string; name: string; shortCode: string }[];
};

export function ProgramRisksRoute() {
  const { programId, slug } = useProgramContext();
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(gridRef, ".animate-card");

  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");

  const risks = useQuery(
    "risks:listByProgram" as any,
    programId
      ? {
          programId,
          ...(severityFilter ? { severity: severityFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }
      : "skip",
  ) as RiskRecord[] | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Risks</h1>
          {risks && (
            <p className="mt-1 text-sm text-text-secondary">
              {risks.length} risk{risks.length !== 1 ? "s" : ""} registered
            </p>
          )}
        </div>
        <button
          onClick={() => router.push(`/${slug}/risks/new`)}
          className="btn-primary btn-sm inline-flex items-center gap-2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Risk
        </button>
      </div>

      {programId && (
        <div className="border-t border-border-default pt-6">
          <RiskAssessmentPanel programId={String(programId)} />
        </div>
      )}

      <RiskFilters
        severity={severityFilter}
        status={statusFilter}
        onSeverityChange={setSeverityFilter}
        onStatusChange={setStatusFilter}
      />

      {risks === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading risks...</p>
        </div>
      ) : risks.length === 0 ? (
        <div className="card border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-interactive-subtle">
            <svg
              className="h-8 w-8 text-accent-default"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          {severityFilter || statusFilter ? (
            <>
              <p className="text-lg font-semibold text-text-primary">No matching risks</p>
              <p className="mt-1 text-sm text-text-secondary">
                No risks match the current filters. Try adjusting or clearing filters.
              </p>
              <button
                onClick={() => {
                  setSeverityFilter("");
                  setStatusFilter("");
                }}
                className="mt-3 text-sm font-medium text-accent-default hover:text-accent-strong"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-text-primary">No risks yet</p>
              <p className="mt-1 text-sm text-text-secondary">
                Track potential issues that could impact your delivery program. Add risks as you
                discover them during planning and execution.
              </p>
              <button
                onClick={() => router.push(`/${slug}/risks/new`)}
                className="btn-primary btn-sm mt-4 inline-flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add your first risk
              </button>
            </>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {risks.map((risk: RiskRecord) => (
            <div key={risk._id} className="animate-card">
              <RiskCard risk={risk} programId={String(programId)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
