"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useProgramContext } from "@/lib/programContext";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { type NextStep, StageNextSteps } from "./StageNextSteps";

interface PipelineStageSprintProps {
  requirement: {
    _id: string;
    orgId: string;
    refId: string;
    title: string;
    priority: string;
    effortEstimate?: string;
    status: string;
  };
  programId: Id<"programs">;
  workstreamId: Id<"workstreams">;
  tasks: Array<{
    _id: string;
    title: string;
    status: string;
    sprintName?: string;
  }>;
}

const EFFORT_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
};

export function PipelineStageSprint({
  requirement,
  programId,
  workstreamId,
  tasks,
}: PipelineStageSprintProps) {
  const { slug } = useProgramContext();
  const sprints = useQuery(api.sprints.listByProgram, { programId });

  const updateTask = useMutation(api.tasks.update);
  const createTask = useMutation(api.tasks.create);
  const createSprint = useMutation(api.sprints.create);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSprintName, setNewSprintName] = useState("");
  const [newSprintStart, setNewSprintStart] = useState("");
  const [newSprintEnd, setNewSprintEnd] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const assignedSprint = tasks.find((t) => t.sprintName)?.sprintName;

  async function handleAssignSprint(sprintId: string) {
    setAssigning(sprintId);
    try {
      if (tasks.length > 0) {
        await Promise.all(
          tasks.map((task) =>
            updateTask({
              taskId: task._id as Id<"tasks">,
              sprintId: sprintId as Id<"sprints">,
            }),
          ),
        );
      } else {
        const priorityMap: Record<string, "critical" | "high" | "medium" | "low"> = {
          must_have: "high",
          should_have: "medium",
          nice_to_have: "low",
          deferred: "low",
        };
        await createTask({
          orgId: requirement.orgId,
          programId,
          title: `Implement: ${requirement.title}`,
          workstreamId,
          sprintId: sprintId as Id<"sprints">,
          requirementId: requirement._id as Id<"requirements">,
          priority: priorityMap[requirement.priority] ?? "medium",
          status: "backlog",
        });
      }
    } finally {
      setAssigning(null);
    }
  }

  async function handleCreateAndAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!newSprintName.trim()) return;
    setIsCreating(true);
    try {
      const sprintId = await createSprint({
        orgId: requirement.orgId,
        programId,
        workstreamId,
        name: newSprintName.trim(),
        ...(newSprintStart ? { startDate: new Date(newSprintStart).getTime() } : {}),
        ...(newSprintEnd ? { endDate: new Date(newSprintEnd).getTime() } : {}),
      });
      await handleAssignSprint(sprintId);
      setNewSprintName("");
      setNewSprintStart("");
      setNewSprintEnd("");
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  }

  const sprintNextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    if (!assignedSprint) {
      steps.push({
        label: "Assign to a sprint",
        description: "Select a sprint above to assign this requirement and begin work.",
      });
    }
    if (tasks.length === 0) {
      steps.push({
        label: "Run AI task decomposition",
        description: "Generate implementation tasks automatically using AI-powered decomposition.",
      });
    }
    return steps;
  }, [assignedSprint, tasks.length]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">Sprint Planning</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Sprint Assignment</span>
            {assignedSprint ? (
              <span className="rounded-full bg-status-info-bg px-2.5 py-0.5 text-xs font-medium text-accent-default">
                {assignedSprint}
              </span>
            ) : (
              <span className="text-xs text-text-muted">Not yet assigned</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Effort Estimate</span>
            <span className="text-sm text-text-heading">
              {requirement.effortEstimate
                ? (EFFORT_LABEL[requirement.effortEstimate] ?? requirement.effortEstimate)
                : "Not estimated"}
            </span>
          </div>

          {tasks.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Tasks Generated</span>
              <span className="text-sm text-text-heading">{tasks.length}</span>
            </div>
          )}
        </div>

        {/* Available sprints with inline assign */}
        {sprints && !assignedSprint && (
          <div className="mt-4 border-t border-border-default pt-3">
            {sprints.length > 0 && (
              <>
                <p className="mb-2 text-xs font-medium text-text-secondary">Available Sprints</p>
                <div className="space-y-1">
                  {sprints.map((sprint: any) => (
                    <div
                      key={sprint._id}
                      className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-text-primary">{sprint.name}</span>
                        <span className="ml-2 rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
                          {sprint.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssignSprint(sprint._id)}
                        disabled={assigning !== null}
                        className="ml-2 shrink-0 rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                      >
                        {assigning === sprint._id ? "Assigning..." : "Assign"}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className={sprints.length > 0 ? "mt-3 border-t border-border-default pt-3" : ""}>
              {!showCreateForm ? (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="text-sm font-medium text-accent-default"
                >
                  + New Sprint
                </button>
              ) : (
                <form onSubmit={handleCreateAndAssign} className="space-y-2">
                  <input
                    type="text"
                    placeholder="e.g., Sprint 2 - Discovery"
                    value={newSprintName}
                    onChange={(e) => setNewSprintName(e.target.value)}
                    className="input"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">Start date</label>
                      <input
                        type="date"
                        value={newSprintStart}
                        onChange={(e) => setNewSprintStart(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">End date</label>
                      <input
                        type="date"
                        value={newSprintEnd}
                        onChange={(e) => setNewSprintEnd(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isCreating || !newSprintName.trim()}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isCreating ? "Creating..." : "Create & Assign"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-interactive-hover"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick link to sprint planning */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/sprints`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Go to Sprint Planning
        </Link>
      </div>

      <StageNextSteps steps={sprintNextSteps} />
    </div>
  );
}
