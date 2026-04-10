"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProgramContext } from "../programs";

type Priority = "critical" | "high" | "medium" | "low";
type Status = "backlog" | "todo" | "in_progress" | "review" | "done";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export function ProgramTaskNewRoute() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const createTask = useMutation("tasks:create" as any);

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const sprints = useQuery("sprints:listByProgram" as any, programId ? { programId } : "skip");

  const teamMembers = useQuery(
    "teamMembers:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const requirements = useQuery(
    "requirements:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const existingTasks = useQuery("tasks:listByProgram" as any, programId ? { programId } : "skip");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<Status>("backlog");
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedBlockedBy, setSelectedBlockedBy] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter sprints by selected workstream
  const filteredSprints =
    selectedWorkstreamId && sprints
      ? (sprints as any[]).filter((s: any) => s.workstreamId === selectedWorkstreamId)
      : sprints;

  function toggleBlockedBy(taskId: string) {
    setSelectedBlockedBy((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!organization?.id) {
      setError("No organization selected");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createTask({
        orgId: organization.id,
        programId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        workstreamId: selectedWorkstreamId ? (selectedWorkstreamId as any) : undefined,
        sprintId: selectedSprintId ? (selectedSprintId as any) : undefined,
        requirementId: selectedRequirementId ? (selectedRequirementId as any) : undefined,
        assigneeId: selectedAssigneeId ? (selectedAssigneeId as any) : undefined,
        blockedBy: selectedBlockedBy.length > 0 ? (selectedBlockedBy as any) : undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      });
      router.push(`/${slug}/tasks`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto container space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="type-display-m text-text-heading">Create Task</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-6">
          {/* Title */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Task Title <span className="text-status-error-fg">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Implement checkout flow migration"
              className="input w-full"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what needs to be done..."
              className="textarea w-full"
            />
          </div>

          {/* Priority + Status */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Priority <span className="text-status-error-fg">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="select w-full"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="select w-full"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Workstream + Sprint */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Workstream
              </label>
              {workstreams === undefined ? (
                <p className="text-xs text-text-muted">Loading...</p>
              ) : (
                <select
                  value={selectedWorkstreamId}
                  onChange={(e) => {
                    setSelectedWorkstreamId(e.target.value);
                    setSelectedSprintId(""); // Reset sprint on workstream change
                  }}
                  className="select w-full"
                >
                  <option value="">None</option>
                  {(workstreams as any[]).map((ws: any) => (
                    <option key={ws._id} value={ws._id}>
                      {ws.shortCode} - {ws.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Sprint</label>
              {sprints === undefined ? (
                <p className="text-xs text-text-muted">Loading...</p>
              ) : (
                <select
                  value={selectedSprintId}
                  onChange={(e) => setSelectedSprintId(e.target.value)}
                  className="select w-full"
                >
                  <option value="">None</option>
                  {(filteredSprints as any[] | undefined)?.map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Requirement */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Linked Requirement
            </label>
            {requirements === undefined ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : (
              <select
                value={selectedRequirementId}
                onChange={(e) => setSelectedRequirementId(e.target.value)}
                className="select w-full"
              >
                <option value="">None</option>
                {(requirements as any[]).map((req: any) => (
                  <option key={req._id} value={req._id}>
                    {req.refId} - {req.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Assignee */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-text-secondary">Assignee</label>
            {teamMembers === undefined ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : (
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="select w-full"
              >
                <option value="">Unassigned</option>
                {(teamMembers as any[]).map((m: any) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.name ?? "Unknown"} ({m.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Due Date */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-text-secondary">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Blocked By multi-select */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Blocked By</label>
            {existingTasks === undefined ? (
              <p className="text-xs text-text-muted">Loading tasks...</p>
            ) : existingTasks.length === 0 ? (
              <p className="text-xs text-text-muted">No existing tasks to block on</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border-default p-2">
                {(existingTasks as any[]).map((t: any) => {
                  const isSelected = selectedBlockedBy.includes(t._id);
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => toggleBlockedBy(t._id)}
                      className={`mb-1 block w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-interactive-subtle text-accent-default"
                          : "text-text-secondary hover:bg-interactive-hover"
                      }`}
                    >
                      <span className="font-medium">{isSelected ? "[x] " : "[ ] "}</span>
                      {t.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
