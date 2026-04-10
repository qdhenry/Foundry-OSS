"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { OrchestrationWizard } from "../orchestration/OrchestrationWizard";
import { useProgramContext } from "../programs";
import { BranchStrategyPanel } from "./BranchStrategyPanel";
import { SprintCapacityPlanner } from "./SprintCapacityPlanner";
import { SprintOrchestrationPanel } from "./SprintOrchestrationPanel";

type SprintStatus = "planning" | "active" | "completed" | "cancelled";

type SprintRecord = {
  _id: string;
  name: string;
  number: number;
  status: SprintStatus;
  workstreamId: string;
  startDate?: number;
  endDate?: number;
  goal?: string;
};

type WorkstreamRecord = {
  _id: string;
  name: string;
};

const STATUS_BADGE: Record<SprintStatus, { label: string; classes: string }> = {
  planning: {
    label: "Planning",
    classes: "badge",
  },
  active: {
    label: "Active",
    classes: "badge badge-success",
  },
  completed: {
    label: "Completed",
    classes: "badge badge-info",
  },
  cancelled: {
    label: "Cancelled",
    classes: "badge badge-error",
  },
};

function SprintReadinessBar({
  hasDates,
  hasGoal,
  hasTasks,
  hasBranches,
}: {
  hasDates: boolean;
  hasGoal: boolean;
  hasTasks: boolean;
  hasBranches: boolean;
}) {
  const checks = [
    { label: "Dates", done: hasDates, anchor: "date-range" },
    { label: "Goal", done: hasGoal, anchor: "goal" },
    { label: "Tasks", done: hasTasks, anchor: "sprint-tasks" },
    { label: "Branches", done: hasBranches, anchor: "branch-strategy" },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const allDone = doneCount === checks.length;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
        allDone
          ? "border-status-success-border bg-status-success-bg/50"
          : "border-border-default bg-surface-raised"
      }`}
    >
      <div className="flex items-center gap-4">
        {checks.map((check) => (
          <button
            key={check.label}
            onClick={() => {
              document
                .getElementById(check.anchor)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-text-primary"
          >
            {check.done ? (
              <svg
                className="h-4 w-4 text-status-success-fg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="9" />
              </svg>
            )}
            <span className={check.done ? "text-text-secondary" : "text-text-muted"}>
              {check.label}
            </span>
          </button>
        ))}
      </div>
      <span
        className={`text-xs font-medium ${allDone ? "text-status-success-fg" : "text-text-muted"}`}
      >
        {allDone ? "Ready to activate" : `${doneCount} of ${checks.length} ready`}
      </span>
    </div>
  );
}

function formatDate(ts?: number): string {
  if (!ts) return "--";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProgramSprintDetailRoute() {
  const params = useParams();
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const { programId, slug } = useProgramContext();
  const sprintId = params.sprintId as string;
  const [showOrchWizard, setShowOrchWizard] = useState(false);

  const sprint = useQuery(
    "sprints:get" as any,
    sprintId ? { sprintId: sprintId as any } : "skip",
  ) as SprintRecord | null | undefined;
  const workstream = useQuery(
    "workstreams:get" as any,
    sprint?.workstreamId ? { workstreamId: sprint.workstreamId as any } : "skip",
  ) as WorkstreamRecord | null | undefined;

  const sprintTaskCount = useQuery(
    "tasks:countBySprint" as any,
    sprintId ? { sprintId: sprintId as any } : "skip",
  ) as number | undefined;

  const strategyData = useQuery(
    "sourceControl/branching/strategyRecommendation:getStrategyForSprint" as any,
    sprintId ? { sprintId: sprintId as any } : "skip",
  );

  const sprintPlanComplete = (sprintTaskCount ?? 0) >= 1;

  const activateSprint = useMutation("sprints:activate" as any);
  const completeSprint = useMutation("sprints:complete" as any);
  const updateSprint = useMutation("sprints:update" as any);
  const removeSprint = useMutation("sprints:remove" as any);

  const [isActivating, setIsActivating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [isEditingEndDate, setIsEditingEndDate] = useState(false);

  if (sprint === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading sprint...</p>
      </div>
    );
  }

  if (sprint === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Sprint not found</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-accent-default hover:text-accent-strong"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[sprint.status as SprintStatus];

  async function handleActivate() {
    setIsActivating(true);
    try {
      await activateSprint({ sprintId: sprintId as any });
    } finally {
      setIsActivating(false);
    }
  }

  async function handleComplete() {
    setIsCompleting(true);
    try {
      await completeSprint({ sprintId: sprintId as any });
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removeSprint({ sprintId: sprintId as any });
      router.push(`/${slug}/sprints`);
    } finally {
      setIsDeleting(false);
    }
  }

  function startEditingGoal() {
    setGoalDraft(sprint?.goal ?? "");
    setIsEditingGoal(true);
  }

  async function handleSaveGoal() {
    setIsSavingGoal(true);
    try {
      await updateSprint({
        sprintId: sprintId as any,
        goal: goalDraft.trim() || undefined,
      });
      setIsEditingGoal(false);
    } finally {
      setIsSavingGoal(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/${slug}/sprints`)}
        className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-secondary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Sprints
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="type-display-m text-text-heading">{sprint.name}</h1>
            <span className="badge">#{sprint.number}</span>
            <span className={`${statusBadge.classes}`}>{statusBadge.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-text-secondary">
            {workstream && <span>{workstream.name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(sprint.status === "planning" || sprint.status === "active") && (
            <button
              type="button"
              onClick={() => setShowOrchWizard(true)}
              className="btn-primary btn-sm"
            >
              Execute Sprint
            </button>
          )}
          {sprint.status === "planning" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete this sprint permanently"
              className="rounded-lg px-3 py-1.5 text-sm text-status-error-fg transition-colors hover:bg-status-error-bg"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {sprint.status === "planning" && (
        <SprintReadinessBar
          hasDates={!!sprint.startDate && !!sprint.endDate}
          hasGoal={!!sprint.goal}
          hasTasks={(sprintTaskCount ?? 0) >= 1}
          hasBranches={strategyData?.status === "pending"}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 id="date-range" className="mb-4 text-lg font-semibold text-text-primary">
              Date Range
            </h2>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Start
                </span>
                {isEditingStartDate ? (
                  <input
                    type="date"
                    className="mt-0.5 block rounded-md border border-border-default bg-surface-default px-2 py-1 text-sm text-text-primary focus:border-accent-default focus:outline-none"
                    defaultValue={
                      sprint.startDate ? new Date(sprint.startDate).toISOString().split("T")[0] : ""
                    }
                    onBlur={async (e) => {
                      const val = e.target.value;
                      if (val) {
                        await updateSprint({
                          sprintId: sprintId as any,
                          startDate: new Date(val).getTime(),
                        });
                      }
                      setIsEditingStartDate(false);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) {
                          await updateSprint({
                            sprintId: sprintId as any,
                            startDate: new Date(val).getTime(),
                          });
                        }
                        setIsEditingStartDate(false);
                      } else if (e.key === "Escape") {
                        setIsEditingStartDate(false);
                      }
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setIsEditingStartDate(true)}
                    className={`mt-0.5 block transition-colors ${
                      sprint.startDate
                        ? "text-text-secondary hover:text-text-primary"
                        : "text-accent-default hover:text-accent-strong"
                    }`}
                    title="Click to set start date"
                  >
                    {sprint.startDate ? formatDate(sprint.startDate) : "Set date"}
                  </button>
                )}
              </div>
              <svg
                className="h-4 w-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  End
                </span>
                {isEditingEndDate ? (
                  <input
                    type="date"
                    className="mt-0.5 block rounded-md border border-border-default bg-surface-default px-2 py-1 text-sm text-text-primary focus:border-accent-default focus:outline-none"
                    defaultValue={
                      sprint.endDate ? new Date(sprint.endDate).toISOString().split("T")[0] : ""
                    }
                    onBlur={async (e) => {
                      const val = e.target.value;
                      if (val) {
                        await updateSprint({
                          sprintId: sprintId as any,
                          endDate: new Date(val).getTime(),
                        });
                      }
                      setIsEditingEndDate(false);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) {
                          await updateSprint({
                            sprintId: sprintId as any,
                            endDate: new Date(val).getTime(),
                          });
                        }
                        setIsEditingEndDate(false);
                      } else if (e.key === "Escape") {
                        setIsEditingEndDate(false);
                      }
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setIsEditingEndDate(true)}
                    className={`mt-0.5 block transition-colors ${
                      sprint.endDate
                        ? "text-text-secondary hover:text-text-primary"
                        : "text-accent-default hover:text-accent-strong"
                    }`}
                    title="Click to set end date"
                  >
                    {sprint.endDate ? formatDate(sprint.endDate) : "Set date"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="goal" className="text-lg font-semibold text-text-primary">
                Goal
              </h2>
              {!isEditingGoal && (
                <button
                  onClick={startEditingGoal}
                  className="text-sm text-accent-default transition-colors hover:text-accent-strong"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingGoal ? (
              <div className="space-y-3">
                <textarea
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  rows={4}
                  placeholder="What should this sprint achieve?"
                  className="textarea w-full"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsEditingGoal(false)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveGoal}
                    disabled={isSavingGoal}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    {isSavingGoal ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : sprint.goal ? (
              <p className="text-sm text-text-secondary">{sprint.goal}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text-muted">
                  No goal set for this sprint. Define what this sprint should achieve.
                </p>
                <button
                  onClick={startEditingGoal}
                  className="text-sm font-medium text-accent-default transition-colors hover:text-accent-strong"
                >
                  Set sprint goal
                </button>
              </div>
            )}
          </div>

          <div id="sprint-tasks" className="card p-5">
            <SprintCapacityPlanner
              sprintId={sprintId}
              programId={String(programId)}
              workstreamId={sprint.workstreamId}
            />
          </div>

          <div id="branch-strategy">
            <BranchStrategyPanel
              sprintId={sprintId}
              programId={String(programId)}
              sprintPlanComplete={sprintPlanComplete}
              strategyData={strategyData}
            />
          </div>
        </div>

        <div className="space-y-4">
          {(sprint.status === "planning" || sprint.status === "active") && (
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Actions</h2>
              <div className="space-y-3">
                {sprint.status === "planning" && (
                  <>
                    <button
                      onClick={handleActivate}
                      disabled={isActivating}
                      title="Start this sprint and close any other active sprint in this workstream"
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {isActivating ? "Activating..." : "Activate Sprint"}
                    </button>
                    <p className="text-xs text-text-muted">
                      Activating this sprint will complete any other active sprint in this
                      workstream.
                    </p>
                  </>
                )}
                {sprint.status === "active" && (
                  <>
                    <button
                      onClick={handleComplete}
                      disabled={isCompleting}
                      className="w-full rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
                    >
                      {isCompleting ? "Completing..." : "Complete Sprint"}
                    </button>
                    <p className="text-xs text-text-muted">
                      Mark this sprint as completed. This cannot be undone.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Status
                </dt>
                <dd className="mt-0.5">
                  <span className={`${statusBadge.classes}`}>{statusBadge.label}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Sprint Number
                </dt>
                <dd className="mt-0.5 text-text-secondary">#{sprint.number}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Workstream
                </dt>
                <dd className="mt-0.5 text-text-secondary">{workstream?.name ?? "Loading..."}</dd>
              </div>
            </dl>
          </div>

          <SprintOrchestrationPanel programId={String(programId)} />
        </div>
      </div>

      {showDeleteConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-text-primary">Delete Sprint?</h3>
              <p className="mt-2 text-sm text-text-secondary">
                This will permanently delete sprint &quot;{sprint.name}&quot; (#{sprint.number}).
                This action cannot be undone.
              </p>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showOrchWizard && orgId && (
        <OrchestrationWizard
          orgId={orgId}
          programId={programId}
          onClose={() => setShowOrchWizard(false)}
          onComplete={(orchRunId) => {
            setShowOrchWizard(false);
            router.push(`/${programId}/orchestration/${orchRunId}`);
          }}
          initialScope={{ scopeType: "sprint", sprintId }}
        />
      )}
    </div>
  );
}
