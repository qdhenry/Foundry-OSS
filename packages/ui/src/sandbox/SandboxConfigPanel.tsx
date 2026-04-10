"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useId, useMemo, useState } from "react";
import { useServiceGate } from "../resilience/useServiceGate";
import { GitHubInstallCTA, RepoPickerDropdown } from "../source-control";
import {
  type EditorType,
  isDesktopRuntimeEnvironment,
  normalizeEditorType,
  resolveEditorTypeForRuntime,
} from "./editorRuntime";
import { useSandboxHUD } from "./SandboxHUDContext";

type AuthProvider = "anthropic" | "bedrock" | "vertex" | "azure";
type RuntimeSelection = "local" | "cloud";

const RUNTIME_SELECTION_STORAGE_KEY = "foundry:runtime-selection";

interface ModelOption {
  id: string;
  displayName: string;
}

const FALLBACK_MODELS: ModelOption[] = [
  { id: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
];

interface PresetOption {
  id: string;
  name: string;
  editorType?: EditorType;
  ttlMinutes?: number;
  authProvider?: AuthProvider;
  mcpServerOverrides?: string[];
}

interface MCPOption {
  id: string;
  label: string;
}

function buildInitialPrompt(task: {
  title: string;
  description?: string | null;
  requirementTitle?: string | null;
  requirementRefId?: string | null;
}) {
  const lines = [`Implement this task: ${task.title}`];

  if (task.description?.trim()) {
    lines.push("", "Task context:", task.description.trim());
  }

  if (task.requirementTitle?.trim()) {
    const requirement = task.requirementRefId
      ? `${task.requirementRefId} - ${task.requirementTitle.trim()}`
      : task.requirementTitle.trim();
    lines.push("", "Linked requirement:", requirement);
  }

  lines.push(
    "",
    "Expected outcome:",
    "- Implement the required code changes.",
    "- Add or update tests for the changed behavior.",
    "- Summarize what changed, risks, and follow-up steps.",
  );

  return lines.join("\n");
}

function extractSessionId(result: unknown): string | undefined {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.sessionId === "string") return r.sessionId;
    if (typeof r._id === "string") return r._id;
    if (typeof r.id === "string") return r.id;
  }
  return undefined;
}

type QueuedLaunchResult = {
  queued: true;
  queueId?: string;
  queuePosition?: number;
  status?: string;
};

function extractQueuedLaunchResult(result: unknown): QueuedLaunchResult | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  if (record.queued !== true) return null;

  return {
    queued: true,
    queueId: typeof record.queueId === "string" ? record.queueId : undefined,
    queuePosition:
      typeof record.queuePosition === "number" && Number.isFinite(record.queuePosition)
        ? Math.max(1, Math.floor(record.queuePosition))
        : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
  };
}

function clampTtl(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 15;
  return Math.min(60, Math.max(5, Math.round(numeric)));
}

function normalizeAuthProvider(value: unknown): AuthProvider | undefined {
  if (value === "anthropic" || value === "bedrock" || value === "vertex" || value === "azure")
    return value;
  return undefined;
}

function parseMcpOverrides(raw: string) {
  if (!raw.trim()) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}

function looksLikeArgumentValidationError(error: unknown) {
  const message = resolveErrorMessage(error, "");
  return /ArgumentValidationError|extra field|unexpected field|Object has extra|missing required/i.test(
    message,
  );
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (message && typeof message === "object") {
      try {
        const serialized = JSON.stringify(message);
        if (serialized && serialized !== "{}") {
          return serialized;
        }
      } catch {
        // fall through to fallback
      }
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

function logSandboxConfigPanel(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>,
) {
  const prefix = `[SandboxConfigPanel] ${message}`;
  try {
    if (level === "error") {
      if (details) {
        console.error(prefix, details);
      } else {
        console.error(prefix);
      }
      return;
    }
    if (level === "warn") {
      if (details) {
        console.warn(prefix, details);
      } else {
        console.warn(prefix);
      }
      return;
    }
    if (details) {
      console.info(prefix, details);
    } else {
      console.info(prefix);
    }
  } catch {
    // Never allow logging to crash UI flows.
  }
}

export function SandboxConfigPanel() {
  const { isConfigPanelOpen, configPanelContext, closeConfig, openTab, localLaunchHandler } =
    useSandboxHUD();

  const programId = configPanelContext?.programId;
  const programSlug = configPanelContext?.programSlug;
  const taskId = configPanelContext?.taskId;
  const task = configPanelContext?.task;

  const skills = useQuery(
    "skills:listByProgram" as any,
    programId ? { programId: programId as any } : "skip",
  ) as any[] | undefined;

  const repositories = useQuery(
    "sourceControl/repositories:listByProgram" as any,
    programId ? { programId: programId as any } : "skip",
  ) as any[] | undefined;

  const launchAgent = useAction("sandbox/orchestrator:start" as any);
  const startSubtaskExecution = useAction("sandbox/orchestrator:startSubtaskExecution" as any);
  const executeSingleSubtask = useAction("sandbox/orchestrator:executeSingleSubtask" as any);

  const cachedModels = useQuery("ai/modelsInternal:listModels" as any) as
    | ModelOption[]
    | null
    | undefined;
  const ensureModelCache = useAction("ai/models:ensureModelCache" as any);
  const { assertAvailable } = useServiceGate();
  const modelOptions: ModelOption[] = cachedModels ?? FALLBACK_MODELS;

  const supportsLocalRuntime = typeof localLaunchHandler === "function";
  const isDesktopRuntime = supportsLocalRuntime && isDesktopRuntimeEnvironment();

  const [taskPrompt, setTaskPrompt] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [editorType, setEditorType] = useState<EditorType>(() =>
    resolveEditorTypeForRuntime("monaco", {
      desktopRuntime: isDesktopRuntime,
      fallback: "monaco",
    }),
  );
  const [ttlMinutes, setTtlMinutes] = useState(15);
  const [authProvider, setAuthProvider] = useState<AuthProvider>("anthropic");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedMcpServers, setSelectedMcpServers] = useState<string[]>([]);
  const [customMcpOverrides, setCustomMcpOverrides] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const [runtimeSelection, setRuntimeSelection] = useState<RuntimeSelection>(() => {
    if (typeof window === "undefined") {
      return "cloud";
    }

    const persisted = window.localStorage.getItem(RUNTIME_SELECTION_STORAGE_KEY);
    if (persisted === "local" || persisted === "cloud") {
      return supportsLocalRuntime ? persisted : "cloud";
    }

    return supportsLocalRuntime ? "local" : "cloud";
  });

  const _repoFieldId = useId();
  const skillFieldId = useId();
  const presetFieldId = useId();
  const authProviderFieldId = useId();
  const modelFieldId = useId();
  const ttlFieldId = useId();
  const customMcpFieldId = useId();
  const promptFieldId = useId();

  const editorTypeOptions = useMemo(
    () =>
      isDesktopRuntime
        ? [
            { value: "codemirror", label: "CodeMirror" },
            { value: "none", label: "None" },
          ]
        : [
            { value: "monaco", label: "Monaco" },
            { value: "codemirror", label: "CodeMirror" },
            { value: "none", label: "None" },
          ],
    [isDesktopRuntime],
  );

  useEffect(() => {
    if (!supportsLocalRuntime && runtimeSelection !== "cloud") {
      setRuntimeSelection("cloud");
      return;
    }

    if (supportsLocalRuntime && typeof window !== "undefined") {
      const persisted = window.localStorage.getItem(RUNTIME_SELECTION_STORAGE_KEY);
      if (!persisted && runtimeSelection !== "local") {
        setRuntimeSelection("local");
      }
    }
  }, [runtimeSelection, supportsLocalRuntime]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      RUNTIME_SELECTION_STORAGE_KEY,
      supportsLocalRuntime ? runtimeSelection : "cloud",
    );
  }, [runtimeSelection, supportsLocalRuntime]);

  const presetOptions = useMemo<PresetOption[]>(() => {
    const raw = (configPanelContext as any)?.sandboxPresets;
    if (!Array.isArray(raw)) return [];
    const normalized: PresetOption[] = [];
    for (const item of raw as any[]) {
      const id = String(item?._id ?? item?.id ?? "");
      const name = String(item?.name ?? "");
      if (!id || !name) continue;
      normalized.push({
        id,
        name,
        editorType: normalizeEditorType(item?.editorType),
        ttlMinutes: typeof item?.ttlMinutes === "number" ? clampTtl(item.ttlMinutes) : undefined,
        authProvider: normalizeAuthProvider(item?.authProvider),
        mcpServerOverrides: Array.isArray(item?.mcpServerOverrides)
          ? item.mcpServerOverrides.filter(
              (entry: unknown): entry is string => typeof entry === "string",
            )
          : undefined,
      });
    }
    return normalized;
  }, [configPanelContext]);

  const mcpServerOptions = useMemo<MCPOption[]>(() => {
    const raw = (configPanelContext as any)?.availableMcpServers;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: any) => {
        if (typeof item === "string") {
          return { id: item, label: item } satisfies MCPOption;
        }
        const id = String(item?.name ?? item?.id ?? item?.key ?? "");
        if (!id) return null;
        const label = String(item?.displayName ?? item?.label ?? id);
        return { id, label } satisfies MCPOption;
      })
      .filter((entry): entry is MCPOption => entry !== null);
  }, [configPanelContext]);

  const contextDefaults = useMemo(
    () => (configPanelContext as any)?.sandboxDefaults ?? {},
    [configPanelContext],
  );
  const defaultPresetId = String((configPanelContext as any)?.defaultPresetId ?? "");

  // Reset form when panel opens with new context
  useEffect(() => {
    if (!isConfigPanelOpen || !task) return;
    const prompt = configPanelContext?.subtaskPrompt?.trim();

    const defaultEditorType = resolveEditorTypeForRuntime(contextDefaults?.editorType, {
      desktopRuntime: isDesktopRuntime,
      fallback: isDesktopRuntime ? "codemirror" : "monaco",
    });
    const defaultAuthProvider = normalizeAuthProvider(contextDefaults?.authProvider) ?? "anthropic";
    const defaultTtl = clampTtl(contextDefaults?.ttlMinutes);
    const defaultOverrides: string[] = Array.isArray(contextDefaults?.mcpServerOverrides)
      ? contextDefaults.mcpServerOverrides.filter(
          (entry: unknown): entry is string => typeof entry === "string",
        )
      : [];
    const knownMcpIds = new Set(mcpServerOptions.map((option) => option.id));
    const knownOverrides = defaultOverrides.filter((entry: string) => knownMcpIds.has(entry));
    const customOverrides = defaultOverrides.filter((entry: string) => !knownMcpIds.has(entry));

    setTaskPrompt(prompt ? prompt : buildInitialPrompt(task));
    setSelectedSkillId("");
    setSelectedRepoId("");
    setSelectedPresetId(defaultPresetId);
    setEditorType(defaultEditorType);
    setTtlMinutes(defaultTtl);
    setAuthProvider(defaultAuthProvider);
    setSelectedModel("");
    setSelectedMcpServers(knownOverrides);
    setCustomMcpOverrides(customOverrides.join(", "));
    setIsLaunching(false);
    setError(null);
    setQueueNotice(null);
  }, [
    isConfigPanelOpen,
    task?.title,
    configPanelContext?.subtaskPrompt,
    contextDefaults,
    defaultPresetId,
    mcpServerOptions,
    isDesktopRuntime,
  ]);

  // Apply preset values when selection changes
  useEffect(() => {
    if (!selectedPresetId) return;
    const selectedPreset = presetOptions.find((preset) => preset.id === selectedPresetId);
    if (!selectedPreset) return;

    if (selectedPreset.editorType) {
      setEditorType(
        resolveEditorTypeForRuntime(selectedPreset.editorType, {
          desktopRuntime: isDesktopRuntime,
          fallback: "none",
        }),
      );
    }
    if (selectedPreset.authProvider) setAuthProvider(selectedPreset.authProvider);
    if (typeof selectedPreset.ttlMinutes === "number")
      setTtlMinutes(clampTtl(selectedPreset.ttlMinutes));

    if (selectedPreset.mcpServerOverrides) {
      const knownMcpIds = new Set(mcpServerOptions.map((option) => option.id));
      const knownOverrides = selectedPreset.mcpServerOverrides.filter((entry: string) =>
        knownMcpIds.has(entry),
      );
      const customOverrides = selectedPreset.mcpServerOverrides.filter(
        (entry: string) => !knownMcpIds.has(entry),
      );
      setSelectedMcpServers(knownOverrides);
      setCustomMcpOverrides(customOverrides.join(", "));
    }
  }, [selectedPresetId, presetOptions, mcpServerOptions, isDesktopRuntime]);

  // Populate model cache on first open when stale/missing
  useEffect(() => {
    if (cachedModels === null) {
      ensureModelCache().catch(() => {});
    }
  }, [cachedModels, ensureModelCache]);

  // Escape to close (skip if a <select> is focused — Escape closes the dropdown, not the panel)
  useEffect(() => {
    if (!isConfigPanelOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLaunching) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "SELECT") return;
        closeConfig();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isConfigPanelOpen, isLaunching, closeConfig]);

  const repoOptions = Array.isArray(repositories) ? repositories : [];
  const skillOptions = Array.isArray(skills) ? skills : [];

  // Auto-select repository when only one exists
  useEffect(() => {
    if (isConfigPanelOpen && repoOptions.length === 1 && !selectedRepoId) {
      setSelectedRepoId(String(repoOptions[0]?._id ?? ""));
    }
  }, [isConfigPanelOpen, repoOptions, selectedRepoId]);
  const canLaunch = Boolean(selectedRepoId && taskPrompt.trim()) && !isLaunching;

  const { subtaskId, subtaskIds, subtaskTitle, mode } = configPanelContext ?? {};

  function getTitle() {
    if (subtaskId) return "Execute Subtask";
    if (subtaskIds?.length) return `Execute ${subtaskIds.length} Selected Subtasks`;
    if (mode === "allSubtasks" || mode === "all") return "Execute All Subtasks";
    return "Assign to Agent";
  }

  function getDescription() {
    if (subtaskId) return `Run "${subtaskTitle}" in an isolated sandbox.`;
    if (subtaskIds?.length) return `Execute ${subtaskIds.length} selected subtasks sequentially.`;
    if (mode === "allSubtasks" || mode === "all")
      return "Execute all subtasks sequentially in isolated sandboxes.";
    return "Launch an isolated sandbox to implement this task.";
  }

  function getLaunchLabel() {
    if (subtaskId) return "Execute Subtask";
    if (subtaskIds?.length) return `Execute ${subtaskIds.length} Subtasks`;
    if (mode === "allSubtasks" || mode === "all") return "Execute All Subtasks";
    return "Launch Agent";
  }

  function toggleMcpServer(serverId: string) {
    setSelectedMcpServers((current) =>
      current.includes(serverId)
        ? current.filter((entry) => entry !== serverId)
        : [...current, serverId],
    );
  }

  async function handleLaunch() {
    try {
      assertAvailable(["convex", "sandbox", "anthropic"]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Required services unavailable");
      return;
    }
    if (!taskPrompt.trim()) {
      setError("Task prompt is required.");
      return;
    }
    if (!selectedRepoId) {
      setError("Select a repository before launching.");
      return;
    }
    if (!taskId) {
      setError("Task context missing.");
      return;
    }
    if (runtimeSelection === "local" && !programId) {
      setError("Program context missing for local launch.");
      return;
    }

    setIsLaunching(true);
    setError(null);
    setQueueNotice(null);

    logSandboxConfigPanel("info", "Launch requested", {
      runtime: runtimeSelection,
      taskId,
      programId: programId ?? null,
      repositoryId: selectedRepoId,
      mode: mode ?? "task",
      hasSubtaskId: Boolean(subtaskId),
      subtaskCount: Array.isArray(subtaskIds) ? subtaskIds.length : 0,
      promptLength: taskPrompt.trim().length,
      presetId: selectedPresetId || null,
      selectedMcpCount: selectedMcpServers.length,
    });

    const payload: Record<string, unknown> = {
      taskId: taskId as any,
      repositoryId: selectedRepoId as any,
      taskPrompt: taskPrompt.trim(),
    };
    if (selectedSkillId) payload.skillId = selectedSkillId as any;

    const mergedMcpOverrides = Array.from(
      new Set([...selectedMcpServers, ...parseMcpOverrides(customMcpOverrides)]),
    );
    const runtimeEditorType = resolveEditorTypeForRuntime(editorType, {
      desktopRuntime: isDesktopRuntime,
      fallback: "none",
    });

    const enhancedPayload: Record<string, unknown> = {
      ...payload,
      editorType: runtimeEditorType,
      ttlMinutes,
      authProvider,
      ...(selectedModel ? { model: selectedModel } : {}),
      ...(selectedPresetId ? { presetId: selectedPresetId as any } : {}),
      ...(mergedMcpOverrides.length > 0 ? { mcpServerOverrides: mergedMcpOverrides } : {}),
    };

    try {
      if (runtimeSelection === "local" && localLaunchHandler) {
        logSandboxConfigPanel("info", "Dispatching local launch handler", {
          taskId,
          repositoryId: selectedRepoId,
        });
        const localResult = await localLaunchHandler({
          taskId,
          programId: programId!,
          repositoryId: selectedRepoId,
          taskPrompt: taskPrompt.trim(),
          ...(selectedSkillId ? { skillId: selectedSkillId } : {}),
          ...(selectedModel ? { model: selectedModel } : {}),
          editorType: runtimeEditorType,
          ttlMinutes,
          authProvider,
          ...(selectedPresetId ? { presetId: selectedPresetId } : {}),
          ...(mergedMcpOverrides.length > 0 ? { mcpServerOverrides: mergedMcpOverrides } : {}),
          ...(contextDefaults?.workspaceCustomization
            ? { workspaceCustomization: contextDefaults.workspaceCustomization }
            : {}),
          ...(subtaskId ? { subtaskId } : {}),
          ...(subtaskIds && subtaskIds.length > 0 ? { subtaskIds } : {}),
          ...(mode ? { mode } : {}),
        });

        logSandboxConfigPanel("info", "Local launch handler completed", {
          sessionId: localResult?.sessionId ?? null,
        });

        if (localResult?.sessionId && task && programSlug) {
          openTab({
            sessionId: localResult.sessionId,
            taskId: taskId!,
            programSlug,
            taskTitle: subtaskTitle ?? task.title ?? "Task",
            status: "executing",
            runtimeMode: "executing",
          });
        }

        closeConfig();
        return;
      }

      let launchFn: typeof launchAgent;
      if (subtaskId) {
        launchFn = executeSingleSubtask;
        payload.subtaskId = subtaskId as any;
        enhancedPayload.subtaskId = subtaskId as any;
      } else if (subtaskIds && subtaskIds.length > 0) {
        launchFn = startSubtaskExecution;
        payload.subtaskIds = subtaskIds;
        enhancedPayload.subtaskIds = subtaskIds;
      } else if (mode === "allSubtasks" || mode === "all") {
        launchFn = startSubtaskExecution;
      } else {
        launchFn = launchAgent;
      }

      let result: unknown;
      try {
        let cloudLaunchAction = "start";
        if (subtaskId) {
          cloudLaunchAction = "executeSingleSubtask";
        } else if (subtaskIds && subtaskIds.length > 0) {
          cloudLaunchAction = "startSubtaskExecution(selected)";
        } else if (mode === "allSubtasks" || mode === "all") {
          cloudLaunchAction = "startSubtaskExecution(all)";
        }

        logSandboxConfigPanel("info", "Dispatching cloud launch action", {
          action: cloudLaunchAction,
        });
        result = await launchFn(enhancedPayload as any);
      } catch (errorWithEnhancedPayload) {
        if (!looksLikeArgumentValidationError(errorWithEnhancedPayload)) {
          throw errorWithEnhancedPayload;
        }
        logSandboxConfigPanel("warn", "Enhanced payload rejected; retrying with legacy payload", {
          error: resolveErrorMessage(errorWithEnhancedPayload, "Argument validation failed"),
        });
        result = await launchFn(payload as any);
      }

      const queuedLaunch = extractQueuedLaunchResult(result);
      if (queuedLaunch) {
        const queuePositionText =
          typeof queuedLaunch.queuePosition === "number"
            ? ` Queue position: ${queuedLaunch.queuePosition}.`
            : "";
        const queueIdText = queuedLaunch.queueId ? ` Queue ID: ${queuedLaunch.queueId}.` : "";
        setQueueNotice(
          `Sandbox infrastructure is currently unavailable. Your launch request was queued and will start automatically when capacity returns.${queuePositionText}${queueIdText}`,
        );
        logSandboxConfigPanel("warn", "Launch request queued", {
          queueId: queuedLaunch.queueId ?? null,
          queuePosition: queuedLaunch.queuePosition ?? null,
          status: queuedLaunch.status ?? null,
        });
        return;
      }

      const sessionId = extractSessionId(result);

      logSandboxConfigPanel("info", "Cloud launch completed", {
        sessionId: sessionId ?? null,
      });

      if (sessionId && task && programSlug) {
        openTab({
          sessionId,
          taskId: taskId!,
          programSlug,
          taskTitle: subtaskTitle ?? task.title ?? "Task",
          status: "provisioning",
        });
      }

      closeConfig();
    } catch (err: unknown) {
      setQueueNotice(null);
      const resolvedMessage = resolveErrorMessage(err, "Failed to launch sandbox agent.");
      logSandboxConfigPanel("error", "Launch failed", {
        runtime: runtimeSelection,
        taskId,
        repositoryId: selectedRepoId || null,
        message: resolvedMessage,
      });
      setError(resolvedMessage);
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 ${
          isConfigPanelOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (!isLaunching) closeConfig();
        }}
      />

      {/* Slide-out panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-xl flex-col border-l border-border-default bg-surface-default shadow-2xl transition-transform duration-200 ${
          isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border-default px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-text-heading">{getTitle()}</h2>
            <p className="mt-0.5 text-sm text-text-secondary">{getDescription()}</p>
          </div>
          <button
            onClick={closeConfig}
            disabled={isLaunching}
            className="ml-4 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary disabled:opacity-50"
            aria-label="Close config panel"
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

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* V1 defaults — read-only */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">V1 Defaults:</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-raised px-2.5 py-0.5 text-xs text-text-secondary">
                keepAlive: <strong>true</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-raised px-2.5 py-0.5 text-xs text-text-secondary">
                sleepAfter: <strong>1h</strong>
              </span>
            </div>

            {supportsLocalRuntime ? (
              <div className="card card-body">
                <h3 className="text-sm font-semibold text-text-heading">Execution Runtime</h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Choose where this run executes. Local launches directly from your desktop
                  workspace.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-raised p-1">
                  {(
                    [
                      { value: "local", label: "Local" },
                      { value: "cloud", label: "Cloud" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRuntimeSelection(option.value)}
                      disabled={isLaunching}
                      aria-pressed={runtimeSelection === option.value}
                      className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        runtimeSelection === option.value
                          ? "bg-surface-default text-text-primary shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Repository */}
            <div>
              <label className="form-label">Repository</label>
              <GitHubInstallCTA purpose="launch sandboxes" />
              {programId && (
                <RepoPickerDropdown
                  programId={programId as string}
                  entityType="sandbox"
                  onSelect={(repoId) => setSelectedRepoId(repoId)}
                  showCreateOption={false}
                />
              )}
              {selectedRepoId && (
                <p className="mt-1 text-xs text-text-secondary">
                  Selected:{" "}
                  {repoOptions.find((r: any) => r._id === selectedRepoId)?.repoFullName ??
                    selectedRepoId}
                </p>
              )}
              {repositories !== undefined && repoOptions.length === 0 && (
                <p className="mt-1 text-xs text-status-warning-fg">
                  No repositories are connected to this program yet.
                </p>
              )}
            </div>

            {/* Skill */}
            <div>
              <label htmlFor={skillFieldId} className="form-label">
                Skill <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <select
                id={skillFieldId}
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                disabled={isLaunching || skills === undefined}
                className="select"
              >
                <option value="">{skills === undefined ? "Loading skills..." : "No skill"}</option>
                {skillOptions.map((skill: any) => (
                  <option key={skill._id} value={skill._id}>
                    {skill.name}
                    {skill.domain ? ` (${skill.domain})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="card card-body">
              <h3 className="text-sm font-semibold text-text-heading">Sandbox Runtime</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Configure editor, TTL, auth provider, and optional MCP/preset overrides.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor={presetFieldId} className="form-label">
                    Preset <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <select
                    id={presetFieldId}
                    value={selectedPresetId}
                    onChange={(event) => setSelectedPresetId(event.target.value)}
                    disabled={isLaunching}
                    className="select"
                  >
                    <option value="">Manual configuration</option>
                    {presetOptions.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  {presetOptions.length === 0 ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      No presets are available yet. Launch will use manual settings.
                    </p>
                  ) : null}
                </div>

                <div>
                  <span className="form-label">Editor Type</span>
                  <div
                    className="grid gap-1 rounded-lg bg-surface-raised p-1"
                    style={{
                      gridTemplateColumns: `repeat(${editorTypeOptions.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {editorTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setEditorType(option.value as EditorType)}
                        disabled={isLaunching}
                        className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                          editorType === option.value
                            ? "bg-surface-default text-text-primary shadow-sm"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor={ttlFieldId} className="form-label">
                    TTL ({ttlMinutes} minutes)
                  </label>
                  <input
                    id={ttlFieldId}
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={ttlMinutes}
                    onChange={(event) => setTtlMinutes(clampTtl(event.target.value))}
                    disabled={isLaunching}
                    className="w-full accent-accent-default"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                    <span>5m</span>
                    <span>60m</span>
                  </div>
                </div>

                <div>
                  <label htmlFor={authProviderFieldId} className="form-label">
                    Auth Provider
                  </label>
                  <select
                    id={authProviderFieldId}
                    value={authProvider}
                    onChange={(event) =>
                      setAuthProvider(normalizeAuthProvider(event.target.value) ?? "anthropic")
                    }
                    disabled={isLaunching}
                    className="select"
                  >
                    <option value="anthropic">Anthropic API</option>
                    <option value="bedrock">AWS Bedrock</option>
                    <option value="vertex">Google Vertex</option>
                    <option value="azure">Azure</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={modelFieldId} className="form-label">
                    Model <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <select
                    id={modelFieldId}
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    disabled={isLaunching}
                    className="select"
                  >
                    <option value="">Default (CLI default)</option>
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="form-label">
                    MCP Overrides <span className="font-normal text-text-muted">(optional)</span>
                  </span>
                  {mcpServerOptions.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {mcpServerOptions.map((server) => (
                        <label
                          key={server.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-default px-2.5 py-1.5 text-xs text-text-primary"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMcpServers.includes(server.id)}
                            onChange={() => toggleMcpServer(server.id)}
                            disabled={isLaunching}
                            className="rounded border-border-default text-accent-default focus:ring-accent-default"
                          />
                          <span className="truncate">{server.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      No MCP server catalog is available yet.
                    </p>
                  )}
                  <input
                    id={customMcpFieldId}
                    value={customMcpOverrides}
                    onChange={(event) => setCustomMcpOverrides(event.target.value)}
                    disabled={isLaunching}
                    placeholder="Additional MCP servers (comma-separated)"
                    className="mt-2 select"
                  />
                </div>
              </div>
            </div>

            {/* Task Prompt */}
            <div>
              <label htmlFor={promptFieldId} className="form-label">
                Task Prompt
              </label>
              <textarea
                id={promptFieldId}
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                disabled={isLaunching}
                rows={12}
                className="select"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
                {error}
              </div>
            )}

            {queueNotice && (
              <div className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg">
                {queueNotice}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border-default px-6 py-4">
          <button
            onClick={closeConfig}
            disabled={isLaunching}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isLaunching ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Launching...
              </>
            ) : (
              getLaunchLabel()
            )}
          </button>
        </div>
      </div>
    </>
  );
}
