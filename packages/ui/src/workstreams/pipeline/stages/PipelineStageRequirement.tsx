"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { type NextStep, StageNextSteps } from "./StageNextSteps";

const PRIORITY_OPTIONS = [
  { value: "must_have", label: "Must Have" },
  { value: "should_have", label: "Should Have" },
  { value: "nice_to_have", label: "Nice to Have" },
  { value: "deferred", label: "Deferred" },
];

const FIT_GAP_OPTIONS = [
  { value: "native", label: "Native" },
  { value: "config", label: "Config" },
  { value: "custom_dev", label: "Custom Dev" },
  { value: "third_party", label: "3rd Party" },
  { value: "not_feasible", label: "Not Feasible" },
];

const EFFORT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "deferred", label: "Deferred" },
];

interface PipelineStageRequirementProps {
  requirement: {
    _id: string;
    orgId: string;
    refId: string;
    title: string;
    description?: string;
    priority: string;
    fitGap: string;
    effortEstimate?: string;
    status: string;
  };
  programId: string;
  workstreamId: string;
  tasks: Array<{ _id: string; title: string; status: string; sprintName?: string }>;
  onNavigateToStage?: (stage: string) => void;
}

export function PipelineStageRequirement({
  requirement,
  programId,
  workstreamId,
  tasks,
  onNavigateToStage,
}: PipelineStageRequirementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [assigningSprint, setAssigningSprint] = useState<string | null>(null);

  const sprints = useQuery("sprints:listByProgram" as any, { programId });
  const updateTask = useMutation("tasks:update" as any);
  const createTask = useMutation("tasks:create" as any);
  const createSprint = useMutation("sprints:create" as any);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSprintName, setNewSprintName] = useState("");
  const [newSprintStart, setNewSprintStart] = useState("");
  const [newSprintEnd, setNewSprintEnd] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const assignedSprintName = tasks.find((t: any) => t.sprintName)?.sprintName;

  async function handleAssignSprint(sprintId: string) {
    setAssigningSprint(sprintId);
    try {
      if (tasks.length > 0) {
        // Assign existing tasks to the sprint
        await Promise.all(
          tasks.map((t: any) =>
            updateTask({
              taskId: t._id as string,
              sprintId: sprintId as string,
            }),
          ),
        );
      } else {
        // No tasks yet — create an initial task assigned to this sprint
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
          sprintId: sprintId as string,
          requirementId: requirement._id as string,
          priority: priorityMap[requirement.priority] ?? "medium",
          status: "backlog",
        });
      }
    } finally {
      setAssigningSprint(null);
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

  const [isApproving, setIsApproving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [editTitle, setEditTitle] = useState(requirement.title);
  const [editDesc, setEditDesc] = useState(requirement.description ?? "");
  const [editPriority, setEditPriority] = useState(requirement.priority);
  const [editFitGap, setEditFitGap] = useState(requirement.fitGap);
  const [editEffort, setEditEffort] = useState(requirement.effortEstimate ?? "");
  const [editStatus, setEditStatus] = useState(requirement.status);

  const updateRequirement = useMutation("requirements:update" as any);
  const updateStatus = useMutation("requirements:updateStatus" as any);
  const requestDecomposition = useMutation("taskDecomposition:requestDecomposition" as any);

  async function handleSave() {
    await updateRequirement({
      requirementId: requirement._id as string,
      title: editTitle,
      description: editDesc || undefined,
      priority: editPriority as any,
      fitGap: editFitGap as any,
      effortEstimate: editEffort ? (editEffort as any) : undefined,
      status: editStatus as any,
    });
    setIsEditing(false);
  }

  async function handleApprove() {
    setIsApproving(true);
    try {
      await updateStatus({
        requirementId: requirement._id as string,
        status: "approved" as any,
      });
    } finally {
      setIsApproving(false);
    }
  }

  async function handleGenerateTasks() {
    setIsGenerating(true);
    try {
      await requestDecomposition({
        requirementId: requirement._id as string,
      });
      // Navigate to task generation stage to show streaming progress
      onNavigateToStage?.("task_generation");
    } finally {
      setIsGenerating(false);
    }
  }

  const nextSteps = useMemo(() => {
    const steps: NextStep[] = [];
    if (!requirement.effortEstimate) {
      steps.push({
        label: "Set effort estimate",
        description: "An effort estimate helps with sprint planning and workload balancing.",
        onClick: () => setIsEditing(true),
      });
    }
    if (requirement.status === "draft") {
      steps.push({
        label: "Approve the requirement",
        description: "Change status to Approved so it can be assigned to a sprint.",
        onClick: handleApprove,
      });
    }
    if (requirement.status === "approved" && tasks.length === 0) {
      steps.push({
        label: "Generate Tasks with AI",
        description:
          "Break this requirement into implementation tasks using AI task decomposition.",
        onClick: handleGenerateTasks,
      });
    }
    if (!assignedSprintName) {
      steps.push({
        label: "Assign to a sprint to advance to planning",
        description: "Select a sprint below to move this requirement into Sprint Planning.",
      });
    }
    return steps;
  }, [requirement, assignedSprintName, tasks.length]);

  if (isEditing) {
    return (
      <div className="space-y-4 rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="text-sm font-semibold text-text-heading">Edit Requirement</h3>

        <div>
          <label className="form-label">Title</label>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={3}
            className="textarea"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="form-label">Priority</label>
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
              className="select"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Fit/Gap</label>
            <select
              value={editFitGap}
              onChange={(e) => setEditFitGap(e.target.value)}
              className="select"
            >
              {FIT_GAP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Effort</label>
            <select
              value={editEffort}
              onChange={(e) => setEditEffort(e.target.value)}
              className="select"
            >
              <option value="">Not set</option>
              {EFFORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="select"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            Save Changes
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-interactive-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action banner */}
      {requirement.status === "draft" && (
        <div className="flex items-center justify-between rounded-xl border border-status-info-border bg-status-info-bg px-5 py-3">
          <div>
            <p className="text-sm font-medium text-accent-default">This requirement is in draft</p>
            <p className="text-xs text-accent-default">
              Approve it to unlock task generation and sprint assignment.
            </p>
          </div>
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isApproving ? "Approving..." : "Approve Requirement"}
          </button>
        </div>
      )}

      {requirement.status === "approved" && tasks.length === 0 && (
        <div className="flex items-center justify-between rounded-xl border border-status-info-border bg-status-info-bg px-5 py-3">
          <div>
            <p className="text-sm font-medium text-accent-default">Requirement approved</p>
            <p className="text-xs text-accent-default">
              Generate implementation tasks using AI task decomposition.
            </p>
          </div>
          <button
            onClick={handleGenerateTasks}
            disabled={isGenerating}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Tasks"}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-heading">Requirement Details</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-accent-default"
          >
            Edit
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-text-secondary">Title</span>
            <p className="text-sm text-text-heading">{requirement.title}</p>
          </div>

          {requirement.description && (
            <div>
              <span className="text-xs font-medium text-text-secondary">Description</span>
              <p className="text-sm text-text-primary">{requirement.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <span className="text-xs font-medium text-text-secondary">Priority</span>
              <p className="text-sm text-text-heading">
                {PRIORITY_OPTIONS.find((o) => o.value === requirement.priority)?.label ??
                  requirement.priority}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-text-secondary">Fit/Gap</span>
              <p className="text-sm text-text-heading">
                {FIT_GAP_OPTIONS.find((o) => o.value === requirement.fitGap)?.label ??
                  requirement.fitGap}
              </p>
            </div>
            {requirement.effortEstimate && (
              <div>
                <span className="text-xs font-medium text-text-secondary">Effort</span>
                <p className="text-sm text-text-heading">
                  {EFFORT_OPTIONS.find((o) => o.value === requirement.effortEstimate)?.label ??
                    requirement.effortEstimate}
                </p>
              </div>
            )}
            <div>
              <span className="text-xs font-medium text-text-secondary">Status</span>
              <p className="text-sm text-text-heading">
                {STATUS_OPTIONS.find((o) => o.value === requirement.status)?.label ??
                  requirement.status}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Inline sprint assignment */}
      {!assignedSprintName && sprints && (
        <div className="rounded-xl border border-border-default bg-surface-default p-5">
          <h4 className="mb-2 text-sm font-semibold text-text-heading">Assign to Sprint</h4>
          {sprints.length > 0 && (
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
                    disabled={assigningSprint !== null}
                    className="ml-2 shrink-0 rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    {assigningSprint === sprint._id ? "Assigning..." : "Assign"}
                  </button>
                </div>
              ))}
            </div>
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

      {assignedSprintName && (
        <div className="rounded-lg border border-status-success-border bg-status-success-bg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-status-success-fg">
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
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Assigned to <span className="font-medium">{assignedSprintName}</span>
          </div>
        </div>
      )}

      <StageNextSteps steps={nextSteps} />
    </div>
  );
}
