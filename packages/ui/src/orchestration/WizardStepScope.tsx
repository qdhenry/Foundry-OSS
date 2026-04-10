"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

interface ScopeConfig {
  scopeType: "sprint" | "workstream" | "custom";
  sprintId?: string;
  workstreamId?: string;
  taskIds?: string[];
  repositoryIds: string[];
  name: string;
}

interface WizardStepScopeProps {
  programId: string;
  scopeConfig: ScopeConfig;
  onChange: (config: ScopeConfig) => void;
  initialScope?: {
    scopeType: "sprint" | "workstream";
    sprintId?: string;
    workstreamId?: string;
  };
}

export function WizardStepScope({
  programId,
  scopeConfig,
  onChange,
  initialScope,
}: WizardStepScopeProps) {
  const [tab, setTab] = useState<"sprint" | "workstream" | "custom">(
    initialScope?.scopeType ?? scopeConfig.scopeType ?? "sprint",
  );

  const sprints = useQuery("sprints:listByProgram" as any, {
    programId: programId as any,
  });
  const workstreams = useQuery("workstreams:listByProgram" as any, {
    programId: programId as any,
  });
  const allTasks = useQuery("tasks:listByProgram" as any, {
    programId: programId as any,
  });
  const repos = useQuery("sourceControl/repositories:listByProgram" as any, {
    programId: programId as any,
  });

  // Pre-select from initialScope on mount
  useEffect(() => {
    if (!initialScope) return;
    if (initialScope.scopeType === "sprint" && initialScope.sprintId) {
      onChange({
        ...scopeConfig,
        scopeType: "sprint",
        sprintId: initialScope.sprintId,
      });
    } else if (initialScope.scopeType === "workstream" && initialScope.workstreamId) {
      onChange({
        ...scopeConfig,
        scopeType: "workstream",
        workstreamId: initialScope.workstreamId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nonDoneTasks = (allTasks ?? []).filter(
    (t: any) => t.status !== "done" && t.status !== "cancelled",
  );

  const selectedTaskCount =
    tab === "custom"
      ? (scopeConfig.taskIds ?? []).length
      : tab === "sprint" && scopeConfig.sprintId
        ? nonDoneTasks.filter((t: any) => t.sprintId === scopeConfig.sprintId).length
        : tab === "workstream" && scopeConfig.workstreamId
          ? nonDoneTasks.filter((t: any) => t.workstreamId === scopeConfig.workstreamId).length
          : 0;

  const totalPoints =
    tab === "custom"
      ? nonDoneTasks
          .filter((t: any) => (scopeConfig.taskIds ?? []).includes(t._id))
          .reduce((sum: number, t: any) => sum + (t.storyPoints ?? 0), 0)
      : tab === "sprint" && scopeConfig.sprintId
        ? nonDoneTasks
            .filter((t: any) => t.sprintId === scopeConfig.sprintId)
            .reduce((sum: number, t: any) => sum + (t.storyPoints ?? 0), 0)
        : tab === "workstream" && scopeConfig.workstreamId
          ? nonDoneTasks
              .filter((t: any) => t.workstreamId === scopeConfig.workstreamId)
              .reduce((sum: number, t: any) => sum + (t.storyPoints ?? 0), 0)
          : 0;

  function handleTabChange(newTab: "sprint" | "workstream" | "custom") {
    setTab(newTab);
    onChange({
      ...scopeConfig,
      scopeType: newTab,
      sprintId: undefined,
      workstreamId: undefined,
      taskIds: undefined,
    });
  }

  function handleSelectSprint(sprintId: string, sprintName: string) {
    onChange({
      ...scopeConfig,
      scopeType: "sprint",
      sprintId,
      workstreamId: undefined,
      taskIds: undefined,
      name: `Sprint: ${sprintName}`,
    });
  }

  function handleSelectWorkstream(workstreamId: string, workstreamName: string) {
    onChange({
      ...scopeConfig,
      scopeType: "workstream",
      workstreamId,
      sprintId: undefined,
      taskIds: undefined,
      name: `Workstream: ${workstreamName}`,
    });
  }

  function handleToggleTask(taskId: string) {
    const current = scopeConfig.taskIds ?? [];
    const next = current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId];
    onChange({
      ...scopeConfig,
      scopeType: "custom",
      taskIds: next,
      name: `Custom selection (${next.length} tasks)`,
    });
  }

  function handleToggleRepo(repoId: string) {
    const current = scopeConfig.repositoryIds ?? [];
    const next = current.includes(repoId)
      ? current.filter((id) => id !== repoId)
      : [...current, repoId];
    onChange({ ...scopeConfig, repositoryIds: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 font-medium text-text-heading">Select Scope</h4>
        <div className="inline-flex rounded-lg border border-border-default">
          {(["sprint", "workstream", "custom"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-interactive-active text-white"
                  : "text-text-secondary hover:bg-surface-elevated"
              } ${t === "sprint" ? "rounded-l-lg" : ""} ${t === "custom" ? "rounded-r-lg" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint tab */}
      {tab === "sprint" && (
        <div className="space-y-2">
          {sprints === undefined && (
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
              <div className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
            </div>
          )}
          {sprints !== undefined && sprints.length === 0 && (
            <p className="text-sm text-text-muted">No sprints found.</p>
          )}
          {(sprints ?? []).map((sprint: any) => {
            const taskCount = nonDoneTasks.filter((t: any) => t.sprintId === sprint._id).length;
            return (
              <button
                key={sprint._id}
                type="button"
                onClick={() =>
                  handleSelectSprint(sprint._id, sprint.name ?? sprint.title ?? "Untitled")
                }
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  scopeConfig.sprintId === sprint._id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-border-default bg-surface-default hover:bg-surface-elevated"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text-heading">
                    {sprint.name ?? sprint.title ?? "Untitled Sprint"}
                  </span>
                  <span className="text-xs text-text-muted">
                    {taskCount} task{taskCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {sprint.status && (
                  <span className="text-xs text-text-secondary">{sprint.status}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Workstream tab */}
      {tab === "workstream" && (
        <div className="space-y-2">
          {workstreams === undefined && (
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
              <div className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
            </div>
          )}
          {workstreams !== undefined && workstreams.length === 0 && (
            <p className="text-sm text-text-muted">No workstreams found.</p>
          )}
          {(workstreams ?? []).map((ws: any) => {
            const taskCount = nonDoneTasks.filter((t: any) => t.workstreamId === ws._id).length;
            return (
              <button
                key={ws._id}
                type="button"
                onClick={() => handleSelectWorkstream(ws._id, ws.name ?? ws.title ?? "Untitled")}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  scopeConfig.workstreamId === ws._id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-border-default bg-surface-default hover:bg-surface-elevated"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text-heading">
                    {ws.name ?? ws.title ?? "Untitled Workstream"}
                  </span>
                  <span className="text-xs text-text-muted">
                    {taskCount} task{taskCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {ws.description && (
                  <p className="mt-1 text-xs text-text-secondary line-clamp-1">{ws.description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Custom tab */}
      {tab === "custom" && (
        <div className="space-y-2">
          {allTasks === undefined && (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
            </div>
          )}
          {nonDoneTasks.length === 0 && allTasks !== undefined && (
            <p className="text-sm text-text-muted">No open tasks available.</p>
          )}
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {nonDoneTasks.map((task: any) => {
              const checked = (scopeConfig.taskIds ?? []).includes(task._id);
              return (
                <label
                  key={task._id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
                    checked
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-border-default bg-surface-default hover:bg-surface-elevated"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleTask(task._id)}
                    className="h-4 w-4 rounded border-border-default"
                  />
                  <span className="flex-1 text-text-heading">
                    {task.title ?? task.name ?? "Untitled Task"}
                  </span>
                  {task.storyPoints != null && (
                    <span className="text-xs text-text-muted">{task.storyPoints} SP</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Repository selector */}
      <div>
        <h4 className="mb-2 font-medium text-text-heading">Repositories</h4>
        {repos === undefined && (
          <div className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
        )}
        {repos !== undefined && repos.length === 0 && (
          <p className="text-sm text-text-muted">No repositories connected.</p>
        )}
        <div className="space-y-1">
          {(repos ?? []).map((repo: any) => {
            const checked = (scopeConfig.repositoryIds ?? []).includes(repo._id);
            return (
              <label
                key={repo._id}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
                  checked
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-border-default bg-surface-default hover:bg-surface-elevated"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleRepo(repo._id)}
                  className="h-4 w-4 rounded border-border-default"
                />
                <span className="text-text-heading">
                  {repo.repoFullName ?? repo.name ?? "Unknown repo"}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Task summary */}
      <div className="rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-secondary">
        {selectedTaskCount} task{selectedTaskCount !== 1 ? "s" : ""} selected
        {totalPoints > 0 && <>, {totalPoints} story points</>}
      </div>
    </div>
  );
}
