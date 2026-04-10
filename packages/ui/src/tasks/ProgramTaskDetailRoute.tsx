"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useProgramContext } from "../programs";
import { type HUDConfigContext, useSandboxHUD } from "../sandbox/SandboxHUDContext";
import { SandboxStatusBadge } from "../sandbox/SandboxStatusBadge";
import { TaskAuditTrail } from "./audit/TaskAuditTrail";
import { SubtaskPanel } from "./SubtaskPanel";
import { TaskImplementationPanel } from "./source-control/TaskImplementationPanel";
import { TaskDesignContextCard } from "./TaskDesignContextCard";
import { VerificationPanel } from "./verification/VerificationPanel";

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

const PRIORITY_BADGE: Record<Priority, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_BADGE: Record<Status, string> = {
  backlog: "bg-surface-raised text-text-secondary",
  todo: "bg-status-info-bg text-status-info-fg",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  review: "bg-status-success-bg text-status-success-fg",
  done: "bg-status-success-bg text-status-success-fg",
};

const STATUS_LABEL: Record<Status, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  if (typeof value === "bigint") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }

  return null;
}

function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value == null) {
    return fallback;
  }
  try {
    const serialized = String(value);
    return serialized;
  } catch {
    return fallback;
  }
}

function safeDisplayText(value: unknown, fallback = "Unknown"): string {
  const text = safeString(value, "");
  return text.trim() ? text : fallback;
}

function normalizeStatus(value: unknown): Status {
  return value === "backlog" ||
    value === "todo" ||
    value === "in_progress" ||
    value === "review" ||
    value === "done"
    ? value
    : "backlog";
}

function normalizePriority(value: unknown): Priority {
  return value === "critical" || value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function formatTimeAgo(timestamp: unknown): string {
  const ms = parseTimestamp(timestamp);
  if (ms === null) return "unknown";
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ProgramTaskDetailRoute() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  const { programId, slug } = useProgramContext();
  const safeTaskId = safeString(taskId, "");
  const safeSlug = safeString(slug, "");
  const resolvedProgramId = programId ? String(programId) : "";

  const hudCtx = useSandboxHUD();

  const task = useQuery("tasks:get" as any, taskId ? { taskId } : "skip");

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const sprints = useQuery("sprints:listByProgram" as any, programId ? { programId } : "skip");

  const teamMembers = useQuery(
    "teamMembers:listByProgram" as any,
    programId ? { programId } : "skip",
  );
  const sandboxSession = useQuery(
    "sandbox/sessions:getByTask" as any,
    taskId ? { taskId } : "skip",
  ) as any;
  const orgId = (task as any)?.orgId as string | undefined;

  const sandboxPresets = useQuery(
    "sandbox/presets:listForOrg" as any,
    orgId ? { orgId } : "skip",
  ) as any[] | undefined;

  const sandboxOrgConfig = useQuery(
    "sandbox/configs:getByOrg" as any,
    orgId ? { orgId } : "skip",
  ) as any;

  const defaultAiProvider = useQuery(
    "sandbox/aiProviders:getDefaultMine" as any,
    orgId ? { orgId } : "skip",
  ) as any;

  const updateTask = useMutation("tasks:update" as any);
  const updateStatus = useMutation("tasks:updateStatus" as any);
  const removeTask = useMutation("tasks:remove" as any);
  const shutdownSandbox = useAction("sandbox/orchestrator:shutdown" as any);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  // Force re-render every 60s so relative timestamps stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-register active sandbox sessions in the HUD
  useEffect(() => {
    if (sandboxSession && !["completed", "failed", "cancelled"].includes(sandboxSession.status)) {
      const safeSessionId = safeString(sandboxSession._id);
      if (!safeSessionId) {
        return;
      }

      hudCtx.openTab({
        sessionId: safeSessionId,
        taskId: safeTaskId,
        programSlug: safeSlug,
        taskTitle: safeDisplayText(task?.title, "Task"),
        status: sandboxSession.status,
        setupProgress: sandboxSession.setupProgress,
        runtimeMode: sandboxSession.runtimeMode ?? null,
      });
    }
  }, [
    sandboxSession?._id,
    sandboxSession?.status,
    sandboxSession?.setupProgress,
    sandboxSession?.runtimeMode,
    safeSlug,
    safeTaskId,
    task?.title,
  ]);

  if (task === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading task...</p>
      </div>
    );
  }

  if (task === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Task not found</p>
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

  const taskRecord = task as any;
  const taskTitle = safeDisplayText(taskRecord.title, "Untitled task");
  const taskDescription = safeString(taskRecord.description, "");
  const taskAssigneeName = safeString(taskRecord.assigneeName, "");
  const defaultPreset = Array.isArray(sandboxPresets)
    ? (sandboxPresets.find((preset: any) => preset?.isDefault) ?? sandboxPresets[0])
    : null;

  const availableMcpServers = Array.isArray(sandboxOrgConfig?.mcpServers)
    ? sandboxOrgConfig.mcpServers
        .map((server: any) => {
          const name = String(server?.name ?? "").trim();
          if (!name) return null;
          return {
            id: name,
            name,
            label: name,
            package: server?.package,
          };
        })
        .filter((entry: any) => entry !== null)
    : [];

  const workspaceCustomization = (() => {
    const dotfiles = Array.isArray(sandboxOrgConfig?.dotfiles)
      ? sandboxOrgConfig.dotfiles
          .map((dotfile: any) => {
            const path = safeString(dotfile?.path, "").trim();
            const content = safeString(dotfile?.content, "");
            if (!path) return null;
            return { path, content };
          })
          .filter((entry: any) => entry !== null)
      : [];

    const shellAliases = Array.isArray(sandboxOrgConfig?.shellAliases)
      ? sandboxOrgConfig.shellAliases
          .map((alias: any) => {
            const name = safeString(alias?.name, "").trim();
            const command = safeString(alias?.command, "").trim();
            if (!name || !command) return null;
            return { name, command };
          })
          .filter((entry: any) => entry !== null)
      : [];

    const devToolConfigs = Array.isArray(sandboxOrgConfig?.devToolConfigs)
      ? sandboxOrgConfig.devToolConfigs
          .map((config: any) => {
            const tool = safeString(config?.tool, "").trim();
            const content = safeString(config?.config, "");
            if (!tool) return null;
            return { tool, config: content };
          })
          .filter((entry: any) => entry !== null)
      : [];

    const setupScripts = Array.isArray(sandboxOrgConfig?.setupScripts)
      ? sandboxOrgConfig.setupScripts
          .map((script: any, index: number) => {
            const name = safeString(script?.name, "").trim();
            const content = safeString(script?.script, "");
            const runOrderRaw = script?.runOrder;
            const runOrder =
              typeof runOrderRaw === "number" && Number.isFinite(runOrderRaw) ? runOrderRaw : index;
            if (!name) return null;
            return { name, script: content, runOrder };
          })
          .filter((entry: any) => entry !== null)
      : [];

    if (
      dotfiles.length === 0 &&
      shellAliases.length === 0 &&
      devToolConfigs.length === 0 &&
      setupScripts.length === 0
    ) {
      return undefined;
    }

    return {
      dotfiles,
      shellAliases,
      devToolConfigs,
      setupScripts,
    };
  })();

  function openSandboxConfig(extra: Partial<HUDConfigContext> = {}) {
    if (!resolvedProgramId) {
      return;
    }

    hudCtx.openConfig({
      taskId: safeTaskId,
      programId: resolvedProgramId,
      programSlug: safeSlug,
      task: {
        title: taskTitle,
        description: taskDescription,
        requirementTitle: taskRecord.requirementTitle,
        requirementRefId: taskRecord.requirementRefId,
        hasSubtasks: taskRecord.hasSubtasks,
      },
      sandboxPresets: sandboxPresets ?? [],
      defaultPresetId: defaultPreset?._id ? String(defaultPreset._id) : undefined,
      availableMcpServers,
      sandboxDefaults: {
        editorType: defaultPreset?.editorType,
        ttlMinutes: defaultPreset?.ttlMinutes,
        authProvider: defaultAiProvider?.provider,
        mcpServerOverrides: Array.isArray(defaultPreset?.mcpServerOverrides)
          ? defaultPreset.mcpServerOverrides
          : [],
        ...(workspaceCustomization ? { workspaceCustomization } : {}),
      },
      ...extra,
    });
  }

  async function handleTitleSave() {
    if (!editTitle.trim()) return;
    await updateTask({ taskId, title: editTitle.trim() });
    setIsEditingTitle(false);
  }

  async function handleDescSave() {
    await updateTask({
      taskId,
      description: editDesc.trim() || undefined,
    });
    setIsEditingDesc(false);
  }

  async function handleStatusChange(newStatus: Status) {
    await updateStatus({ taskId, status: newStatus });
  }

  async function handlePriorityChange(newPriority: Priority) {
    await updateTask({ taskId, priority: newPriority });
  }

  async function handleWorkstreamChange(wsId: string) {
    await updateTask({
      taskId,
      workstreamId: wsId ? (wsId as any) : undefined,
    });
  }

  async function handleSprintChange(sId: string) {
    await updateTask({
      taskId,
      sprintId: sId ? (sId as any) : undefined,
    });
  }

  async function handleAssigneeChange(userId: string) {
    await updateTask({
      taskId,
      assigneeId: userId ? (userId as any) : undefined,
    });
  }

  async function handleDueDateChange(dateStr: string) {
    await updateTask({
      taskId,
      dueDate: dateStr ? new Date(dateStr).getTime() : undefined,
    });
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removeTask({ taskId });
      router.push(`/${safeSlug}/tasks`);
    } catch (err) {
      console.error("Failed to delete task:", err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleShutdown() {
    if (!sandboxSession?._id) return;
    setIsShuttingDown(true);
    try {
      await shutdownSandbox({ sessionId: sandboxSession._id });
    } catch (err) {
      console.error("Failed to shutdown sandbox:", err);
    } finally {
      setIsShuttingDown(false);
      setShowShutdownConfirm(false);
    }
  }

  // Filter sprints by the task's current workstream
  const filteredSprints = task.workstreamId
    ? (sprints as any[] | undefined)?.filter((s: any) => s.workstreamId === task.workstreamId)
    : sprints;

  const dueDateTimestamp = parseTimestamp(task.dueDate);
  const dueDateValue =
    dueDateTimestamp !== null ? new Date(dueDateTimestamp).toISOString().split("T")[0] : "";

  const isOverdue =
    dueDateTimestamp !== null && dueDateTimestamp < Date.now() && task.status !== "done";

  const createdAtTimestamp = parseTimestamp(task._creationTime);
  const taskStatus = normalizeStatus(task.status);
  const taskPriority = normalizePriority(task.priority);
  const assigneeValue = safeString(task.assigneeId);
  const workstreamValue = safeString(task.workstreamId);
  const sprintValue = safeString(task.sprintId);
  const blockedBy = Array.isArray(task.resolvedBlockedBy) ? task.resolvedBlockedBy : [];
  if (taskStatus !== task.status || taskPriority !== task.priority) {
    try {
      console.warn("[ProgramTaskDetailRoute] Normalized unexpected task field values", {
        taskId,
        rawStatus: task.status,
        normalizedStatus: taskStatus,
        rawPriority: task.priority,
        normalizedPriority: taskPriority,
      });
    } catch {
      // ignore logging issues
    }
  }

  const activeSandboxSessionId =
    safeString(sandboxSession?._id) ||
    safeString((task as any).activeSandboxSessionId) ||
    safeString((task as any).sandboxSessionId);

  const isSandboxExecutionActive =
    !!activeSandboxSessionId &&
    !!sandboxSession &&
    !["completed", "failed", "cancelled"].includes(sandboxSession.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push(`/${safeSlug}/tasks`)}
            className="mt-1 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
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
          <div>
            {/* Editable title */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="input w-full text-lg font-bold"
                />
                <button onClick={handleTitleSave} className="btn-primary btn-sm">
                  Save
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-interactive-hover"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                onClick={() => {
                  setEditTitle(taskTitle);
                  setIsEditingTitle(true);
                }}
                className="type-display-m cursor-pointer text-text-heading hover:text-accent-default"
                title="Click to edit"
              >
                {taskTitle}
              </h1>
            )}

            {/* Badges row */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`badge ${PRIORITY_BADGE[taskPriority]}`}>
                {PRIORITY_LABEL[taskPriority]}
              </span>
              <span className={`badge ${STATUS_BADGE[taskStatus]}`}>
                {STATUS_LABEL[taskStatus]}
              </span>
              {taskAssigneeName && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {taskAssigneeName}
                </span>
              )}
              {isOverdue && (
                <span className="rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
                  Overdue
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: branch badge + sandbox controls + delete button */}
        <div className="flex items-center gap-3">
          {(() => {
            const branchName =
              safeString((task as any).worktreeBranch) ||
              safeString(sandboxSession?.worktreeBranch);
            const repoFullName = safeString(sandboxSession?.repoFullName) || null;
            return branchName ? (
              <BranchBadge branch={branchName} repoFullName={repoFullName} />
            ) : null;
          })()}

          {/* Sandbox controls */}
          {isSandboxExecutionActive ? (
            <>
              {/* Clickable status badge — opens HUD */}
              <button
                onClick={() => {
                  const sessionId = safeString(sandboxSession._id);
                  if (!sessionId) {
                    return;
                  }
                  hudCtx.focusTab(sessionId);
                  hudCtx.setExpanded(true);
                }}
                className="cursor-pointer"
                title="Open sandbox HUD"
              >
                <SandboxStatusBadge
                  status={sandboxSession.status}
                  runtimeMode={sandboxSession.runtimeMode}
                  setupProgress={sandboxSession.setupProgress}
                />
              </button>

              {/* Shutdown button */}
              <button
                onClick={() => setShowShutdownConfirm(true)}
                className="rounded-lg border border-status-error-fg/20 bg-status-error-bg px-2.5 py-1 text-xs font-medium text-status-error-fg transition-colors hover:bg-status-error-bg/80"
              >
                Shutdown
              </button>
            </>
          ) : (
            <>
              {/* Initialize Sandbox button */}
              <button onClick={() => openSandboxConfig()} className="btn-primary btn-sm">
                Initialize Sandbox
              </button>

              {/* Gear icon — also opens config */}
              <button
                onClick={() => openSandboxConfig()}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
                title="Configure sandbox"
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
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {/* Previous sandbox indicator */}
              {sandboxSession &&
                ["completed", "failed", "cancelled"].includes(sandboxSession.status) && (
                  <span className="text-xs text-text-secondary">
                    Last sandbox:{" "}
                    <span
                      className={
                        sandboxSession.status === "completed"
                          ? "text-status-success-fg"
                          : sandboxSession.status === "failed"
                            ? "text-status-error-fg"
                            : "text-status-warning-fg"
                      }
                    >
                      {sandboxSession.status === "completed"
                        ? "Completed"
                        : sandboxSession.status === "failed"
                          ? "Failed"
                          : "Cancelled"}
                    </span>
                    {sandboxSession.completedAt || sandboxSession.updatedAt ? (
                      <>
                        {" "}
                        ({formatTimeAgo(sandboxSession.completedAt ?? sandboxSession.updatedAt)})
                      </>
                    ) : null}
                  </span>
                )}
            </>
          )}

          {/* Delete button (only for backlog) */}
          {taskStatus === "backlog" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
              title="Delete task"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary">Description</h2>
              {!isEditingDesc && (
                <button
                  onClick={() => {
                    setEditDesc(taskDescription);
                    setIsEditingDesc(true);
                  }}
                  className="text-xs font-medium text-accent-default hover:text-accent-strong"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className="textarea w-full"
                />
                <div className="flex items-center gap-2">
                  <button onClick={handleDescSave} className="btn-primary btn-sm">
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : taskDescription ? (
              <div
                className={[
                  "prose prose-sm max-w-none text-text-secondary",
                  "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-text-heading [&_h1]:mb-2 [&_h1]:mt-3",
                  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-text-heading [&_h2]:mb-1.5 [&_h2]:mt-2.5",
                  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-text-heading [&_h3]:mb-1 [&_h3]:mt-2",
                  "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2 [&_p]:last:mb-0",
                  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:text-sm",
                  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:text-sm",
                  "[&_li]:mb-1 [&_li]:text-sm [&_li]:leading-relaxed",
                  "[&_strong]:font-semibold [&_strong]:text-text-heading",
                  "[&_em]:italic",
                  "[&_code]:text-xs [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
                ].join(" ")}
              >
                <ReactMarkdown>{taskDescription}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No description provided.</p>
            )}
          </div>

          {/* Acceptance Criteria */}
          {taskRecord.acceptanceCriteria && taskRecord.acceptanceCriteria.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-semibold text-text-secondary">
                Acceptance Criteria
              </h2>
              <ul className="space-y-1.5">
                {taskRecord.acceptanceCriteria.map((criterion: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blocked By */}
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-text-secondary">Blocked By</h2>
            {blockedBy.length > 0 ? (
              <div className="space-y-2">
                {blockedBy.map((blocker: any, index: number) => {
                  const blockerId = safeString(blocker?._id, `blocked-${index}`);
                  const blockerStatus = normalizeStatus(blocker?.status);
                  const blockerTitle = safeDisplayText(blocker?.title, "Untitled task");

                  return (
                    <button
                      key={blockerId}
                      onClick={() => router.push(`/${safeSlug}/tasks/${blockerId}`)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-left text-sm transition-colors hover:border-border-accent"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          blockerStatus === "done" ? "bg-status-success-fg" : "bg-status-warning-fg"
                        }`}
                      />
                      <span className="text-text-secondary">{blockerTitle}</span>
                      <span className="ml-auto text-xs text-text-muted">
                        {STATUS_LABEL[blockerStatus]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No blocking tasks.</p>
            )}
          </div>

          {/* Subtasks */}
          <SubtaskPanel
            taskId={taskId}
            task={{
              hasSubtasks: (task as any).hasSubtasks,
              subtaskGenerationStatus: (task as any).subtaskGenerationStatus,
              subtaskGenerationError: (task as any).subtaskGenerationError,
            }}
            isExecutionActive={isSandboxExecutionActive}
            onExecuteAll={() => {
              openSandboxConfig({
                mode: "all",
              });
            }}
            onExecuteSelected={(subtaskIds) => {
              openSandboxConfig({
                mode: "selected",
                subtaskIds: subtaskIds as string[],
              });
            }}
            onExecuteSubtask={(subtaskId, title, prompt) => {
              openSandboxConfig({
                mode: "single",
                subtaskId: subtaskId as string,
                subtaskTitle: title ?? undefined,
                subtaskPrompt: prompt ?? undefined,
              });
            }}
          />

          {/* Implementation */}
          <TaskImplementationPanel taskId={taskId} />

          {/* Verification */}
          <VerificationPanel taskId={taskId} />

          {/* Audit Trail — collapsed by default (logs live in HUD) */}
          <TaskAuditTrail taskId={taskId} defaultCollapsed={true} />

          {/* Linked Requirement */}
          {task.requirementTitle && (
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-semibold text-text-secondary">Linked Requirement</h2>
              <div className="rounded-lg border border-border-default bg-surface-raised px-3 py-2">
                <p className="text-sm text-text-secondary">
                  {task.requirementRefId && (
                    <span className="mr-2 type-code text-text-muted">{task.requirementRefId}</span>
                  )}
                  {task.requirementTitle}
                </p>
              </div>
            </div>
          )}

          {/* Design Context */}
          <TaskDesignContextCard
            taskId={safeTaskId}
            programId={resolvedProgramId}
            programSlug={safeSlug}
          />
        </div>

        {/* Right column: metadata sidebar */}
        <div className="space-y-4">
          {/* Status control */}
          <div className="card p-4">
            <label className="form-label">Status</label>
            <select
              value={taskStatus}
              onChange={(e) => handleStatusChange(e.target.value as Status)}
              className="select w-full"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority control */}
          <div className="card p-4">
            <label className="form-label">Priority</label>
            <select
              value={taskPriority}
              onChange={(e) => handlePriorityChange(e.target.value as Priority)}
              className="select w-full"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Story Points */}
          {taskRecord.storyPoints != null && (
            <div className="card p-4">
              <label className="form-label">Story Points</label>
              <span className="inline-block rounded bg-surface-raised px-2 py-1 text-sm font-semibold text-text-heading">
                {taskRecord.storyPoints} SP
              </span>
            </div>
          )}

          {/* Assignee control */}
          <div className="card p-4">
            <label className="form-label">Assignee</label>
            {teamMembers === undefined ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : (
              <select
                value={assigneeValue}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="select w-full"
              >
                <option value="">Unassigned</option>
                {(teamMembers as any[]).map((m: any) => (
                  <option
                    key={safeString(m.userId, `member-${safeString(m._id)}`)}
                    value={safeString(m.userId)}
                  >
                    {m.user?.name ?? "Unknown"} ({m.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Workstream control */}
          <div className="card p-4">
            <label className="form-label">Workstream</label>
            {workstreams === undefined ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : (
              <select
                value={workstreamValue}
                onChange={(e) => handleWorkstreamChange(e.target.value)}
                className="select w-full"
              >
                <option value="">None</option>
                {(workstreams as any[]).map((ws: any) => (
                  <option
                    key={safeString(ws._id, ws.name ?? "workstream")}
                    value={safeString(ws._id)}
                  >
                    {ws.shortCode} - {ws.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sprint control */}
          <div className="card p-4">
            <label className="form-label">Sprint</label>
            {sprints === undefined ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : (
              <select
                value={sprintValue}
                onChange={(e) => handleSprintChange(e.target.value)}
                className="select w-full"
              >
                <option value="">None</option>
                {(filteredSprints as any[] | undefined)?.map((s: any) => (
                  <option key={safeString(s._id, s.name ?? "sprint")} value={safeString(s._id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Due Date control */}
          <div className="card p-4">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className={`input w-full ${
                isOverdue ? "border-status-error-border text-status-error-fg" : ""
              }`}
            />
          </div>

          {/* Created at */}
          <div className="card p-4">
            <label className="form-label">Created</label>
            <p className="text-sm text-text-secondary">
              {createdAtTimestamp !== null
                ? new Date(createdAtTimestamp).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Unknown"}
            </p>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Delete Task</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Are you sure you want to delete &ldquo;{taskTitle}&rdquo;? This action cannot be
                undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-status-error-bg px-4 py-2 text-sm font-medium text-status-error-fg border border-status-error-border transition-colors hover:opacity-80 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Shutdown confirmation modal */}
      {showShutdownConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowShutdownConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Shutdown Sandbox</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Are you sure you want to shut down this sandbox session? The agent will stop and any
                unsaved work may be lost.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowShutdownConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShutdown}
                  disabled={isShuttingDown}
                  className="rounded-lg bg-status-error-bg px-4 py-2 text-sm font-medium text-status-error-fg border border-status-error-border transition-colors hover:opacity-80 disabled:opacity-50"
                >
                  {isShuttingDown ? "Shutting down..." : "Shutdown"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BranchBadge({ branch, repoFullName }: { branch: string; repoFullName?: string | null }) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const githubUrl = repoFullName ? `https://github.com/${repoFullName}/tree/${branch}` : null;

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-sm font-mono text-text-secondary transition-colors hover:bg-interactive-hover"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span className="max-w-[280px] truncate" title={branch}>
          {branch}
        </span>
        <svg
          className="h-3 w-3 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border-default bg-surface-default py-1 shadow-lg">
            <button
              onClick={() => {
                copyToClipboard(branch, "branch");
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-interactive-hover"
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate font-mono text-xs">{branch}</span>
              {copied === "branch" && (
                <span className="ml-auto text-xs text-status-success-fg">Copied!</span>
              )}
            </button>
            <button
              onClick={() => {
                copyToClipboard(`git checkout ${branch}`, "checkout");
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-interactive-hover"
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-mono text-xs">git checkout {branch}</span>
              {copied === "checkout" && (
                <span className="ml-auto text-xs text-status-success-fg">Copied!</span>
              )}
            </button>
            {githubUrl && (
              <>
                <button
                  onClick={() => {
                    copyToClipboard(githubUrl, "url");
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-interactive-hover"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span className="text-xs">Copy GitHub URL</span>
                  {copied === "url" && (
                    <span className="ml-auto text-xs text-status-success-fg">Copied!</span>
                  )}
                </button>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-interactive-hover"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  <span className="text-xs">Open on GitHub</span>
                </a>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
