"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { WizardStepAssignments } from "./WizardStepAssignments";
import { WizardStepScope } from "./WizardStepScope";

type WizardProgress = null | "creating_run" | "generating_plan" | "starting";

const progressMessages: Record<NonNullable<WizardProgress>, string> = {
  creating_run: "Creating orchestration run...",
  generating_plan: "AI is analyzing tasks and assigning agents... This may take up to a minute.",
  starting: "Starting orchestration workflow...",
};

const progressButtonLabels: Record<NonNullable<WizardProgress>, string> = {
  creating_run: "Creating run...",
  generating_plan: "Generating plan...",
  starting: "Starting...",
};

function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return <span className="text-xs tabular-nums text-text-muted">{display}</span>;
}

interface ScopeConfig {
  scopeType: "sprint" | "workstream" | "custom";
  sprintId?: string;
  workstreamId?: string;
  taskIds?: string[];
  repositoryIds: string[];
  name: string;
}

interface OrchestrationWizardProps {
  orgId: string;
  programId: string;
  onClose: () => void;
  onComplete: (runId: string) => void;
  initialScope?: {
    scopeType: "sprint" | "workstream";
    sprintId?: string;
    workstreamId?: string;
  };
}

const STEP_LABELS = ["Scope", "Assignments", "Preview"] as const;

export function OrchestrationWizard({
  orgId,
  programId,
  onClose,
  onComplete,
  initialScope,
}: OrchestrationWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scopeConfig, setScopeConfig] = useState<ScopeConfig>({
    scopeType: initialScope?.scopeType ?? "sprint",
    sprintId: initialScope?.sprintId,
    workstreamId: initialScope?.workstreamId,
    taskIds: undefined,
    repositoryIds: [],
    name: "",
  });
  const [runId, setRunId] = useState<string | null>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [branchStrategy, setBranchStrategy] = useState<
    "per_agent" | "per_task" | "single_branch" | "custom"
  >("per_task");
  const [branchPattern, setBranchPattern] = useState("orchestration/{run}/{task}");
  const [targetBranch, setTargetBranch] = useState("main");
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [tokenBudget, setTokenBudget] = useState(500000);
  const [progress, setProgress] = useState<WizardProgress>(null);
  const [error, setError] = useState<string | null>(null);

  const resumeAttempted = useRef(false);

  const resumableRun = useQuery(
    "orchestration/runs:getResumableRun" as any,
    programId ? { programId: programId as any } : "skip",
  );

  const activeRun = useQuery(
    "orchestration/runs:get" as any,
    runId ? { runId: runId as any } : "skip",
  );

  const agents = useQuery(
    "agentTeam/agents:listByProgram" as any,
    programId ? { programId: programId as any } : "skip",
  );

  const createRun = useMutation("orchestration/runs:create" as any);
  const generatePlan = useAction("orchestration/planner:generatePlan" as any);
  const startOrchestration = useAction("orchestration/executor:startOrchestration" as any);

  // Auto-resume a resumable run (StrictMode-safe: never reset ref in cleanup)
  useEffect(() => {
    if (resumeAttempted.current || !resumableRun || runId) return;
    resumeAttempted.current = true;

    if (resumableRun.status === "previewing" && resumableRun.executionPlan) {
      setRunId(resumableRun._id);
      setExecutionPlan(resumableRun.executionPlan);
      setStep(2);
    } else if (resumableRun.status === "draft") {
      setRunId(resumableRun._id);
      setProgress("generating_plan");
    }
  }, [resumableRun, runId]);

  // Subscribe to draft run completing plan generation
  useEffect(() => {
    if (!activeRun || step !== 1 || progress !== "generating_plan") return;

    if (activeRun.status === "previewing" && activeRun.executionPlan) {
      setExecutionPlan(activeRun.executionPlan);
      setProgress(null);
      setStep(2);
    } else if (activeRun.status === "failed" || activeRun.status === "cancelled") {
      setProgress(null);
      setError("Plan generation failed. Please try again.");
    }
  }, [activeRun, step, progress]);

  async function handleNext() {
    if (step === 1) {
      setError(null);
      setProgress("creating_run");
      try {
        const id = await createRun({
          orgId,
          programId: programId as any,
          name: scopeConfig.name || "Orchestration Run",
          scopeType: scopeConfig.scopeType,
          sprintId: scopeConfig.sprintId as any,
          workstreamId: scopeConfig.workstreamId as any,
          taskIds: scopeConfig.taskIds as any,
          repositoryIds: scopeConfig.repositoryIds as any,
          branchStrategy,
          branchPattern,
          targetBranch,
          maxConcurrency,
          tokenBudget,
        });
        setRunId(id);
        setProgress("generating_plan");
        const plan = await generatePlan({
          orgId,
          runId: id as any,
          programId: programId as any,
        });
        setExecutionPlan(plan);
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setProgress(null);
      }
    } else if (step === 2) {
      setStep(3);
    }
  }

  async function handleConfirm() {
    if (!runId) return;
    setError(null);
    setProgress("starting");
    try {
      await startOrchestration({
        orgId,
        runId: runId as any,
        programId: programId as any,
      });
      onComplete(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setProgress(null);
    }
  }

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  const canAdvance =
    step === 1 ? scopeConfig.name.length > 0 && scopeConfig.repositoryIds.length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex w-full max-w-3xl flex-col rounded-xl border border-border-default bg-surface-default shadow-xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        {/* Header + step indicator */}
        <div className="border-b border-border-default px-6 pb-4 pt-5">
          <h3 className="mb-4 text-lg font-semibold text-text-heading">New Orchestration Run</h3>
          <div className="flex items-center gap-3">
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2 | 3;
              const isActive = step === stepNum;
              const isComplete = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={`h-px w-8 ${isComplete ? "bg-blue-500" : "bg-border-default"}`}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : isComplete
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-surface-elevated text-text-muted"
                      }`}
                    >
                      {isComplete ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        stepNum
                      )}
                    </div>
                    <span
                      className={`text-sm ${isActive ? "font-medium text-text-heading" : "text-text-muted"}`}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="relative max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="flex-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900 dark:hover:text-red-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Resume info banner */}
          {resumableRun && runId === resumableRun._id && (
            <div className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              Resuming previous run: &ldquo;{resumableRun.name}&rdquo;
            </div>
          )}

          {/* Progress overlay */}
          {progress && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-b-xl bg-surface-default/90 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-spin text-blue-600 dark:text-blue-400"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-heading">{progressMessages[progress]}</p>
              <ElapsedTimer />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-heading">Run Name</label>
                <input
                  type="text"
                  value={scopeConfig.name}
                  onChange={(e) => setScopeConfig({ ...scopeConfig, name: e.target.value })}
                  placeholder="e.g. Sprint 3 Build"
                  className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading placeholder:text-text-muted"
                />
              </div>
              <WizardStepScope
                programId={programId}
                scopeConfig={scopeConfig}
                onChange={setScopeConfig}
                initialScope={initialScope}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-heading">
                    Branch Strategy
                  </label>
                  <select
                    value={branchStrategy}
                    onChange={(e) => setBranchStrategy(e.target.value as any)}
                    className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm"
                  >
                    <option value="per_task">Per Task</option>
                    <option value="per_agent">Per Agent</option>
                    <option value="single_branch">Single Branch</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-heading">
                    Target Branch
                  </label>
                  <input
                    type="text"
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-heading">
                    Max Concurrency
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxConcurrency}
                    onChange={(e) => setMaxConcurrency(Number.parseInt(e.target.value, 10) || 3)}
                    className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-heading">
                    Token Budget
                  </label>
                  <input
                    type="number"
                    min={50000}
                    step={50000}
                    value={tokenBudget}
                    onChange={(e) => setTokenBudget(Number.parseInt(e.target.value, 10) || 500000)}
                    className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {branchStrategy === "custom" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-heading">
                    Branch Pattern
                  </label>
                  <input
                    type="text"
                    value={branchPattern}
                    onChange={(e) => setBranchPattern(e.target.value)}
                    placeholder="orchestration/{run}/{task}"
                    className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <WizardStepAssignments
              programId={programId}
              executionPlan={executionPlan}
              agents={agents as any}
              branchStrategy={branchStrategy}
              onBranchStrategyChange={setBranchStrategy}
              branchPattern={branchPattern}
              onBranchPatternChange={setBranchPattern}
              maxConcurrency={maxConcurrency}
              onMaxConcurrencyChange={setMaxConcurrency}
              targetBranch={targetBranch}
              onTargetBranchChange={setTargetBranch}
              onChange={setExecutionPlan}
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-medium text-text-heading">Review & Confirm</h4>
              <div className="rounded-lg border border-border-default bg-surface-subtle p-4 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <dt className="text-text-secondary">Run Name</dt>
                  <dd className="text-text-heading">{scopeConfig.name || "Unnamed"}</dd>
                  <dt className="text-text-secondary">Scope</dt>
                  <dd className="capitalize text-text-heading">{scopeConfig.scopeType}</dd>
                  <dt className="text-text-secondary">Branch Strategy</dt>
                  <dd className="text-text-heading">{branchStrategy.replaceAll("_", " ")}</dd>
                  <dt className="text-text-secondary">Target Branch</dt>
                  <dd className="text-text-heading">{targetBranch}</dd>
                  <dt className="text-text-secondary">Max Concurrency</dt>
                  <dd className="text-text-heading">{maxConcurrency}</dd>
                  <dt className="text-text-secondary">Token Budget</dt>
                  <dd className="text-text-heading">{tokenBudget.toLocaleString()}</dd>
                  <dt className="text-text-secondary">Repositories</dt>
                  <dd className="text-text-heading">{scopeConfig.repositoryIds.length} selected</dd>
                  <dt className="text-text-secondary">Assignments</dt>
                  <dd className="text-text-heading">
                    {(executionPlan?.assignments ?? executionPlan?.waves ?? []).length} items
                  </dd>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-6 py-4">
          {step > 1 && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!!progress}
              onClick={handleBack}
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={!!progress || !canAdvance}
              onClick={handleNext}
            >
              {progress ? progressButtonLabels[progress] : "Next"}
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={!!progress}
              onClick={handleConfirm}
            >
              {progress ? progressButtonLabels[progress] : "Confirm & Start"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
