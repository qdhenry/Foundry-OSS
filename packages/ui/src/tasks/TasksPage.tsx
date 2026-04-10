"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TaskBoard } from "./TaskBoard";
import { TaskCard } from "./TaskCard";
import { TaskFilters } from "./TaskFilters";

type Priority = "critical" | "high" | "medium" | "low";
type Status = "backlog" | "todo" | "in_progress" | "review" | "done";
type ViewMode = "board" | "list";
type ViewPreset = "active_sprint" | "all" | "backlog";

type TaskListItem = {
  _id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  assigneeName?: string;
  sprintId?: string;
  sprintName?: string;
  workstreamShortCode?: string;
  dueDate?: number;
  hasSubtasks?: boolean;
  subtaskCount?: number;
  subtasksCompleted?: number;
  subtasksFailed?: number;
  lastSubtaskActivity?: string;
  repositoryIds?: string[];
  repoFullName?: string; // resolved from repositoryIds
};

type WorkstreamFilterItem = {
  _id: string;
  name: string;
  shortCode: string;
};

type SprintFilterItem = {
  _id: string;
  name: string;
  workstreamId: string;
  status?: string;
};

export interface TasksPageProps {
  programId: string;
  programSlug: string;
}

export function TasksPage({ programId, programSlug }: TasksPageProps) {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [workstreamFilter, setWorkstreamFilter] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [viewPreset, setViewPreset] = useState<ViewPreset>("active_sprint");
  const [sprintInitialized, setSprintInitialized] = useState(false);

  // Query for active sprint
  const activeSprint = useQuery("sprints:getActive" as any, programId ? { programId } : "skip") as
    | { _id: string; name: string }
    | null
    | undefined;

  // Auto-set sprint filter when active sprint loads
  useEffect(() => {
    if (sprintInitialized) return;
    if (activeSprint === undefined) return; // still loading
    if (activeSprint && viewPreset === "active_sprint") {
      setSprintFilter(activeSprint._id);
    }
    setSprintInitialized(true);
  }, [activeSprint, viewPreset, sprintInitialized]);

  const tasks = useQuery(
    "tasks:listByProgram" as any,
    programId
      ? {
          programId,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(priorityFilter ? { priority: priorityFilter } : {}),
          ...(workstreamFilter ? { workstreamId: workstreamFilter as any } : {}),
          ...(sprintFilter ? { sprintId: sprintFilter as any } : {}),
        }
      : "skip",
  ) as TaskListItem[] | undefined;

  // For backlog preset: filter client-side to tasks with no sprint
  const displayTasks = viewPreset === "backlog" && tasks ? tasks.filter((t) => !t.sprintId) : tasks;

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as WorkstreamFilterItem[] | undefined;

  const sprints = useQuery("sprints:listByProgram" as any, programId ? { programId } : "skip") as
    | SprintFilterItem[]
    | undefined;

  const repos = useQuery(
    "sourceControl/repositories:listByProgram" as any,
    programId ? { programId: programId as any } : "skip",
  ) as Array<{ _id: string; repoFullName: string }> | undefined;

  // Build repo lookup for task cards
  const repoMap = new Map((repos ?? []).map((r) => [r._id, r.repoFullName]));

  const enrichedTasks = displayTasks?.map((task) => ({
    ...task,
    repoFullName: task.repositoryIds?.[0] ? repoMap.get(task.repositoryIds[0]) : undefined,
  }));

  const hasActiveFilters = statusFilter || priorityFilter || workstreamFilter || sprintFilter;

  const handlePresetChange = (preset: ViewPreset) => {
    setViewPreset(preset);
    // Reset filters for preset changes
    setStatusFilter("");
    setPriorityFilter("");
    setWorkstreamFilter("");

    if (preset === "active_sprint" && activeSprint) {
      setSprintFilter(activeSprint._id);
    } else if (preset === "backlog") {
      setSprintFilter(""); // show all, filter client-side
    } else {
      setSprintFilter("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Tasks</h1>
          {displayTasks && (
            <p className="mt-1 text-sm text-text-secondary">
              {displayTasks.length} task{displayTasks.length !== 1 ? "s" : ""}
              {viewPreset === "active_sprint" && activeSprint
                ? ` in ${activeSprint.name}`
                : viewPreset === "backlog"
                  ? " in backlog"
                  : " total"}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push(`/${programSlug}/tasks/new`)}
          className="btn-primary inline-flex items-center gap-2"
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
          Add Task
        </button>
      </div>

      {/* View preset pills */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border-default">
          {(
            [
              { key: "active_sprint", label: "Active Sprint" },
              { key: "all", label: "All Tasks" },
              { key: "backlog", label: "Backlog" },
            ] as { key: ViewPreset; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                viewPreset === key
                  ? "bg-accent-default text-text-on-brand"
                  : "bg-surface-default text-text-secondary hover:bg-interactive-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sprint selector when in active sprint mode */}
        {viewPreset === "active_sprint" && sprints && sprints.length > 0 && (
          <select
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            className="select text-sm"
          >
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <TaskFilters
        status={statusFilter}
        priority={priorityFilter}
        workstreamId={workstreamFilter}
        sprintId={sprintFilter}
        viewMode={viewMode}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onWorkstreamChange={setWorkstreamFilter}
        onSprintChange={setSprintFilter}
        onViewModeChange={setViewMode}
        workstreams={workstreams}
        sprints={sprints}
      />

      {enrichedTasks === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading tasks...</p>
        </div>
      ) : enrichedTasks.length === 0 ? (
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
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          </div>
          {hasActiveFilters ? (
            <>
              <p className="text-lg font-semibold text-text-primary">No matching tasks</p>
              <p className="mt-1 text-sm text-text-secondary">
                No tasks match the current filters. Try adjusting or clearing filters.
              </p>
              <button
                onClick={() => handlePresetChange("all")}
                className="mt-3 text-sm font-medium text-accent-default hover:text-accent-strong"
              >
                View all tasks
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-text-primary">No tasks yet</p>
              <p className="mt-1 text-sm text-text-secondary">
                Tasks are created from requirements. Define requirements first, then decompose them
                into actionable tasks.
              </p>
              <Link
                href={`/${programSlug}/requirements`}
                className="btn-primary btn-sm mt-4 inline-flex items-center gap-2"
              >
                Create tasks from requirements
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
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </>
          )}
        </div>
      ) : viewMode === "board" ? (
        <TaskBoard
          tasks={enrichedTasks ?? []}
          programId={programId}
          programSlug={programSlug}
          sprints={sprints}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrichedTasks?.map((task) => (
            <TaskCard key={task._id} task={task} programId={programId} programSlug={programSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
