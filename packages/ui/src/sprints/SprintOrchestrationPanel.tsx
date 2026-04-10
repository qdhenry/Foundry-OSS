"use client";

import { useMutation, useQuery } from "convex/react";

export function SprintOrchestrationPanel({ programId }: { programId: string }) {
  const workflows = useQuery("agentTeam/workflows:listByProgram" as any, {
    programId: programId as any,
  });
  const updateStatus = useMutation("agentTeam/workflows:updateStatus" as any);

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-text-heading">Sprint Orchestration</h3>
      </div>
      {workflows === undefined && <p className="text-sm text-text-secondary">Loading workflows…</p>}
      {workflows?.length === 0 && (
        <p className="text-sm text-text-secondary">No sprint workflows started yet.</p>
      )}
      <div className="space-y-2">
        {(workflows ?? []).map((workflow: any) => (
          <div key={workflow._id} className="rounded-lg border border-border-default p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium text-text-heading">{workflow.branchName}</div>
              <span className="text-text-secondary">{workflow.status}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  updateStatus({
                    sprintWorkflowId: workflow._id,
                    status: workflow.status === "paused" ? "running" : "paused",
                  })
                }
              >
                {workflow.status === "paused" ? "Resume" : "Pause"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
