"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { type AnalysisConfig, AnalysisConfigPanel } from "./AnalysisConfigPanel";
import { AnalysisRunTimeline } from "./AnalysisRunTimeline";

interface WorkstreamAnalysisTabProps {
  programId: string;
  workstreamId: string;
  repositoryIds: string[];
}

export function WorkstreamAnalysisTab({
  programId,
  workstreamId,
  repositoryIds,
}: WorkstreamAnalysisTabProps) {
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const runs = useQuery(
    "codebaseRequirementAnalysis:listRunsByWorkstream" as any,
    isAuthenticated && orgId ? { orgId, workstreamId } : "skip",
  ) as any[] | undefined;

  const createRun = useMutation("codebaseRequirementAnalysis:createRun" as any);
  const runAnalysis = useAction("codebaseRequirementAnalysisActions:runWorkstreamAnalysis" as any);

  // Check if any run is currently active
  const isRunning =
    runs?.some((r: any) => r.status === "pending" || r.status === "running") ?? false;

  const requirements = useQuery(
    "requirements:listByProgram" as any,
    isAuthenticated && orgId ? { programId, workstreamId } : "skip",
  ) as any[] | undefined;

  const handleRun = async (config: AnalysisConfig) => {
    if (!orgId || !requirements) return;

    const runId = await createRun({
      orgId,
      programId,
      workstreamId,
      scope: "workstream",
      config,
      repositoryIds,
      totalRequirements: requirements.length,
    });

    // Fire the analysis action (runs async, updates come via reactive queries)
    runAnalysis({
      orgId,
      runId,
      programId,
      workstreamId,
    }).catch((err: Error) => {
      console.error("Analysis failed:", err);
    });
  };

  const latestCompleted = runs?.find((r: any) => r.status === "completed");
  const summary = latestCompleted?.summary;

  return (
    <div className="space-y-6">
      <AnalysisConfigPanel
        onRun={handleRun}
        isRunning={isRunning}
        hasRepos={repositoryIds.length > 0}
      />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-status-success-border bg-status-success-bg/30 p-3">
            <p className="text-xl font-bold text-status-success-fg">{summary.fullyImplemented}</p>
            <p className="text-xs text-text-secondary">Fully Implemented</p>
          </div>
          <div className="rounded-lg border border-status-warning-border bg-status-warning-bg/30 p-3">
            <p className="text-xl font-bold text-status-warning-fg">
              {summary.partiallyImplemented}
            </p>
            <p className="text-xs text-text-secondary">Partially Implemented</p>
          </div>
          <div className="rounded-lg border border-status-error-border bg-status-error-bg/30 p-3">
            <p className="text-xl font-bold text-status-error-fg">{summary.notFound}</p>
            <p className="text-xs text-text-secondary">Not Found</p>
          </div>
          <div className="rounded-lg border border-status-info-border bg-status-info-bg/30 p-3">
            <p className="text-xl font-bold text-status-info-fg">{summary.needsVerification}</p>
            <p className="text-xs text-text-secondary">Needs Verification</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Analysis History</h3>
        {runs === undefined ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          </div>
        ) : (
          <AnalysisRunTimeline runs={runs} />
        )}
      </div>
    </div>
  );
}
