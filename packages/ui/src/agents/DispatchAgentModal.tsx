"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { AgentAvatar } from "./AgentAvatar";

export function DispatchAgentModal({
  agent,
  programId,
  orgId,
  onClose,
}: {
  agent: { _id: string; name: string; role: string; avatarSeed: string; model: string };
  programId: string;
  orgId: string;
  onClose: () => void;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState<any>(null);

  const dispatchAgent = useAction("agentTeam/dispatch:dispatchAgent" as any);

  async function handleDispatch() {
    if (!taskTitle.trim()) return;
    setDispatching(true);
    try {
      const response = await dispatchAgent({
        orgId,
        programId: programId as any,
        agentId: agent._id as any,
        taskTitle: taskTitle.trim(),
        taskDescription: taskDescription.trim() || undefined,
      });
      setResult(response);
      toast.success("Agent dispatch complete");
    } catch (err: any) {
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border-default bg-surface-default p-5">
        <div className="mb-4 flex items-center gap-3">
          <AgentAvatar seed={agent.avatarSeed} name={agent.name} size="md" />
          <div>
            <h3 className="text-lg font-semibold text-text-heading">Dispatch Agent</h3>
            <p className="text-sm text-text-secondary">
              {agent.name} &middot; {agent.role.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Task title
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Review authentication flow"
                className="w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading placeholder:text-text-muted focus:border-accent-default focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Description (optional)
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Provide additional context for the agent..."
                rows={4}
                className="w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading placeholder:text-text-muted focus:border-accent-default focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={dispatching || !taskTitle.trim()}
                onClick={handleDispatch}
              >
                {dispatching ? "Dispatching..." : "Dispatch"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border-default bg-surface-subtle p-4">
              <h4 className="mb-2 text-sm font-semibold text-text-heading">Summary</h4>
              <p className="text-sm text-text-secondary">{result.result.summary}</p>
            </div>

            {result.result.findings?.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-sm font-semibold text-text-heading">Findings</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                  {result.result.findings.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.result.nextActions?.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-sm font-semibold text-text-heading">Next Actions</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                  {result.result.nextActions.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>
                {result.tokensUsed?.toLocaleString()} tokens &middot;{" "}
                {(result.durationMs / 1000).toFixed(1)}s
              </span>
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
