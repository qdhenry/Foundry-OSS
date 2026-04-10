"use client";

import { useOrganization } from "@clerk/nextjs";
import { Stars01 } from "@untitledui/icons";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ExecutionOutput } from "./ExecutionOutput";

interface ExecuteSkillModalProps {
  programId: Id<"programs">;
  isOpen: boolean;
  onClose: () => void;
  preselectedSkillId?: Id<"skills">;
  taskId?: Id<"tasks">;
}

export function ExecuteSkillModal({
  programId,
  isOpen,
  onClose,
  preselectedSkillId,
  taskId,
}: ExecuteSkillModalProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  const skills = useQuery(api.skills.listByProgram, programId ? { programId } : "skip");
  const workstreams = useQuery(api.workstreams.listByProgram, programId ? { programId } : "skip");

  const executeSkill = useAction(api.ai.executeSkill);

  const [selectedSkillId, setSelectedSkillId] = useState<string>(preselectedSkillId ?? "");
  const [taskType, setTaskType] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [workstreamId, setWorkstreamId] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{
    executionId: string;
    output: string;
    tokensUsed: number;
    durationMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (!isExecuting) {
      setSelectedSkillId(preselectedSkillId ?? "");
      setTaskType("");
      setTaskPrompt("");
      setWorkstreamId("");
      setResult(null);
      setError(null);
      onClose();
    }
  }

  async function handleExecute() {
    if (!selectedSkillId || !taskType || !taskPrompt || !orgId) return;

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const res = await executeSkill({
        programId,
        skillId: selectedSkillId as Id<"skills">,
        taskPrompt,
        taskType,
        orgId,
        ...(workstreamId ? { workstreamId: workstreamId as Id<"workstreams"> } : {}),
        ...(taskId ? { taskId } : {}),
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  }

  if (!isOpen) return null;

  const selectedSkill = skills?.find((s: any) => s._id === selectedSkillId);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-default bg-surface-default p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-heading">Execute Skill</h2>
            <button
              onClick={handleClose}
              disabled={isExecuting}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary disabled:opacity-50"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!result ? (
            <div className="mt-5 space-y-4">
              {/* Skill selection */}
              <div>
                <label className="form-label">Skill</label>
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  disabled={isExecuting}
                  className="select w-full"
                >
                  <option value="">Select a skill...</option>
                  {skills?.map((skill: any) => (
                    <option key={skill._id} value={skill._id}>
                      {skill.name} ({skill.domain})
                    </option>
                  ))}
                </select>
              </div>

              {/* Task type */}
              <div>
                <label className="form-label">Task Type</label>
                <input
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  disabled={isExecuting}
                  placeholder="e.g. code_review, gap_analysis, implementation"
                  className="input w-full"
                />
              </div>

              {/* Workstream (optional) */}
              <div>
                <label className="form-label">
                  Workstream <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <select
                  value={workstreamId}
                  onChange={(e) => setWorkstreamId(e.target.value)}
                  disabled={isExecuting}
                  className="select w-full"
                >
                  <option value="">All workstreams</option>
                  {workstreams?.map((ws: any) => (
                    <option key={ws._id} value={ws._id}>
                      {ws.shortCode}: {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task prompt */}
              <div>
                <label className="form-label">Task Prompt</label>
                <textarea
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  disabled={isExecuting}
                  rows={5}
                  placeholder="Describe the specific task for the agent..."
                  className="textarea w-full"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-status-error-border bg-status-error-bg p-3 text-sm text-status-error-fg">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  disabled={isExecuting}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecute}
                  disabled={isExecuting || !selectedSkillId || !taskType || !taskPrompt}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Agent is thinking...
                    </>
                  ) : (
                    <>
                      <Stars01 size={16} />
                      Execute
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <ExecutionOutput
                executionId={result.executionId}
                output={result.output}
                skillName={selectedSkill?.name}
                tokensUsed={result.tokensUsed}
                durationMs={result.durationMs}
                reviewStatus="pending"
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
